let version = '0.0.8';
let parents = {};
let tasks = [];
let currentTask = null;
let editMode = false;
let fileHandle = null;
let currentFileName = null;
let currentParentName = null;
let currentBoard = null;
let currentSubtaskTask = null;
let currentSubtask = null;
let currentSubtaskIndex = null;
let currentParentTask = null;
// script.js
import {
  auth,
  db,
  currentUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  getDocs
} from './firebase.js';


//Debug Modus
const DEBUG = true;
function log(...args) {
  if (DEBUG) console.log(...args);
}
function warn(...args) {
  if (DEBUG) console.warn(...args);
}
function error(...args) {
  if (DEBUG) console.error(...args);
}

function loadBoardTitle() {
  const title = localStorage.getItem('sprintBoardTitle') || 'Sprint Board';
  document.getElementById('boardTitle').textContent = title;
}

function toggleEditMode() {
  editMode = !editMode;
  document.getElementById('editToggleButton').classList.toggle('active', editMode);
  renderBoard();
}

function saveBoard() {
  localStorage.setItem('boardData', JSON.stringify({ parents, tasks }));
  if (typeof saveExistingFile === 'function' && fileHandle) {
    saveExistingFile().catch(err => {
      console.warn("Automatisches Speichern fehlgeschlagen:", err);
      showNotification("Fehler beim Speichern.", "error");
    });
  }
}

function loadBoard() {
	log("loadBoard:", "start");
	const data = JSON.parse(localStorage.getItem('boardData')) || { parents: {}, tasks: [] };
	parents = data.parents;
	// Kompatibilität zu alten Strukturen:
	for (const key in parents) {
	  if (typeof parents[key] === 'string') {
		parents[key] = {
		  color: parents[key],
		  order: 0
		};
	  } else {
		if (!parents[key].color) parents[key].color = '#999';
		if (typeof parents[key].order !== 'number') parents[key].order = 0;
	  }
	}
	tasks = data.tasks;
	updateParentSelect();
	renderBoard();
}

function hexToRgba(hex, alpha = 1) {
	//log("hexToRgba:", hex);
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


function updateParentSelect() {
  const select = document.getElementById('parentSelect');
  const editSelect = document.getElementById('editParent');
  if (select) select.innerHTML = '';
  if (editSelect) editSelect.innerHTML = '';
  for (let name in parents) {
    const opt1 = new Option(name, name);
    if (select) select.appendChild(opt1);
    if (editSelect) editSelect.appendChild(new Option(name, name));
  }
}

function addTaskToParent(parent, status) {
  const desc = prompt("Neue Taskbeschreibung für '" + parent + "':");
  if (desc) {
    tasks.push({ desc, parent, status, subtasks: [], dueDate: null });
    renderBoard();
    saveBoardToFirebase();
  }
}

function addSubtask(task) {
  const desc = prompt("Subtask hinzufügen:");
  if (desc) {
    task.subtasks = task.subtasks || [];
    task.subtasks.push({ desc, done: false, attributes: []  });
    renderBoard();
    saveBoardToFirebase();
  }
}

function editSubtask(task, subtask) {
  const newDesc = prompt("Subtask umbenennen:", subtask.desc);
  if (newDesc !== null) {
    subtask.desc = newDesc;
    renderBoard();
    saveBoardToFirebase();
  }
}

function toggleSubtaskDone(taskIndex, subtaskIndex) {
  tasks[taskIndex].subtasks[subtaskIndex].done = !tasks[taskIndex].subtasks[subtaskIndex].done;
  renderBoard();
  saveBoardToFirebase();
}

function addEmptyParentToColumn(status) {
  const name = prompt(`Name des neuen Parent-Elements für "${status}":`);
  if (name && !parents[name]) {
	const maxOrder = Math.max(0, ...Object.values(parents).map(p => p?.order ?? 0));
    parents[name] = {
	  color: '#' + Math.floor(Math.random() * 16777215).toString(16),
	  order: maxOrder + 1
	};
    tasks.push({ desc: 'taskname', parent: name, status, subtasks: [] });
    updateParentSelect();
    saveBoardToFirebase();
    renderBoard();
  } else if (parents[name]) {
    alert("Ein Parent mit diesem Namen existiert bereits.");
  }
}

function renderBoard() {
	log("renderBoard:", "start");
	['ToDo', 'OnHold', 'InProgress', 'Done'].forEach(status => {
		const col = document.getElementById(status);
		if (editMode) {
		  col.innerHTML = `
			<div class="column-header">
			  <h2>${status}</h2>
			  <button onclick="addEmptyParentToColumn('${status}')" class="add-parent-button">+</button>
			</div>`;
		} else {
		  col.innerHTML = `<h2>${status}</h2>`;
		}

    const grouped = {};
	tasks.filter(t => t.status === status).forEach(t => {
	  if (!grouped[t.parent]) grouped[t.parent] = [];
	  grouped[t.parent].push(t);
	});

	// Eltern sortieren nach Reihenfolge
	const sortedParents = Object.keys(grouped).sort((a, b) => {
	  const aOrder = parents[a]?.order ?? 0;
	  const bOrder = parents[b]?.order ?? 0;
	  return aOrder - bOrder;
	});


    sortedParents.forEach(parent => {
      const wrapper = document.createElement('div');
      wrapper.className = 'parent-group';

    // ✅ DRAG-LOGIK
    wrapper.draggable = true;
    wrapper.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'parent-group',
        parent: parent,
        status: status
      }));
    };
    wrapper.ondragover = (e) => {
      e.preventDefault();
      wrapper.classList.add('drag-target');
    };
    wrapper.ondragleave = () => {
      wrapper.classList.remove('drag-target');
    };
    wrapper.ondrop = (e) => {
      e.preventDefault();
      wrapper.classList.remove('drag-target');

      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type !== 'parent-group') return;
      if (data.status !== status) return; // kein Verschieben zwischen Spalten

      const draggedParent = data.parent;

      const parentList = Object.entries(parents)
        .filter(([p]) => tasks.some(t => t.parent === p && t.status === status))
        .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
        .map(([p]) => p);

      const targetIndex = parentList.indexOf(parent);
      parentList.splice(parentList.indexOf(draggedParent), 1);
      parentList.splice(targetIndex, 0, draggedParent);

      parentList.forEach((pName, index) => {
        if (parents[pName]) {
          parents[pName].order = index + 1;
        }
      });

      saveBoardToFirebase();
      renderBoard();
    };
	
	
	wrapper.style.backgroundColor = hexToRgba(parents[parent]?.color, 0.1); // 20% sichtbar = 80% transparent
	wrapper.style.borderColor = parents[parent]?.color;





      // Parent-Header mit Title, Collapse und Add
      const header = document.createElement('div');
      header.className = 'parent-title';
      header.style.borderLeftColor = parents[parent]?.color;

      const title = document.createElement('span');
      title.textContent = `${parent} (${grouped[parent].length})`;
	  
	  const allParentTasks = tasks.filter(t => t.parent === parent);
		const totalTasks = allParentTasks.length;
		const doneTasks = allParentTasks.filter(t => t.status === 'Done').length;
		const progressPercent = Math.round((doneTasks / totalTasks) * 100);


		title.style.cursor = 'pointer';
		title.onclick = (e) => {
		  if (!editMode) return;
		  e.stopPropagation();
		  openParentEditPopup(parent);
		};


      const toggleCollapse = document.createElement('button');
      toggleCollapse.textContent = '⏷';
      toggleCollapse.onclick = (e) => {
        e.stopPropagation();
        wrapper.classList.toggle('collapsed');
        toggleCollapse.textContent = wrapper.classList.contains('collapsed') ? '⏵' : '⏷';
      };

      const addBtn = document.createElement('button');
      addBtn.textContent = '+';
      addBtn.onclick = (e) => {
        e.stopPropagation();
        addTaskToParent(parent, status);
      };

	  header.appendChild(title);
	  header.appendChild(toggleCollapse);
	  if (editMode) {
		  header.appendChild(addBtn);
		}
		wrapper.appendChild(header);
		const progressBarWrapper = document.createElement('div');
		progressBarWrapper.className = 'progress-bar-wrapper';

		const progressBar = document.createElement('div');
		progressBar.className = 'progress-bar';
		progressBar.style.width = `${progressPercent}%`;
		
		const isLight = isLightColor(parents[parent]?.color);
		progressBar.style.setProperty('--stripe-color', isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)');

		progressBarWrapper.appendChild(progressBar);
		wrapper.appendChild(progressBarWrapper);

      // Task-Liste
      const taskList = document.createElement('div');
      taskList.className = 'task-list';

      grouped[parent].forEach(task => {
        const div = document.createElement('div');
        div.className = 'task';
        const index = tasks.indexOf(task);
        div.draggable = true;
        div.ondragstart = e => e.dataTransfer.setData('application/json', JSON.stringify({ index }));

        const taskHeader = document.createElement('div');
        taskHeader.className = 'task-header';

        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '⏷';

        const taskBody = document.createElement('div');
        taskBody.className = 'task-body';
        taskBody.style.display = 'block';

        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          taskBody.style.display = taskBody.style.display === 'none' ? 'block' : 'none';
          toggleBtn.textContent = taskBody.style.display === 'none' ? '⏵' : '⏷';
        };

        const span = document.createElement('span');
        span.textContent = task.desc + (task.subtasks?.length ? ` (${task.subtasks.length})` : '');

        span.onclick = () => {
		  if (!editMode) return;
		  openTaskEditPopup(task);
		};

		taskHeader.appendChild(span);
		taskHeader.appendChild(toggleBtn);

		if (editMode) {
		  const addSubBtn = document.createElement('button');
		  addSubBtn.textContent = '+';
		  addSubBtn.title = 'Subtask hinzufügen';
		  addSubBtn.onclick = (e) => {
			e.stopPropagation();
			addSubtask(task);
		  };
		  taskHeader.appendChild(addSubBtn);
		}

		div.appendChild(taskHeader);


        const subtaskList = document.createElement('div');
		
		if (task.dueDate) {
		  const due = document.createElement('div');
		  due.className = 'subtask';
		  //due.style.opacity = '0.6';
		  due.style.cursor = 'default';
		  due.innerHTML = `
		  <span class="due-label">Due Date</span>
		  <span class="due-value">${task.dueDate}</span>
		`;
		const today = new Date().toISOString().split('T')[0];
		if (task.dueDate < today && task.status !== 'Done') {
		  due.querySelector('.due-value').style.color = 'tomato';
		}
		due.onclick = (e) => {
			if (!editMode) return;
			e.stopPropagation();
			openTaskEditPopup(task);
		};
		subtaskList.appendChild(due);
		}
		
        (task.subtasks || []).forEach((subtask, sIdx) => {
          const sub = document.createElement('div');
          sub.className = 'subtask';
			const checkColor = hexToRgba(parents[task.parent]?.color || '#888', 0.5);

			sub.innerHTML = `
			  <span class="subtask-text">${subtask.desc}</span>
			  <input type='checkbox' class='subtask-check' ${subtask.done ? 'checked' : ''} style="--check-bg: ${checkColor}" onchange='toggleSubtaskDone(${index}, ${sIdx})'>
			`;

          sub.onclick = (f) => {
				if (!editMode) return;
				f.stopPropagation();
				openSubtaskEditPopup(task,sIdx);
			};
          subtaskList.appendChild(sub);
        });
			
		

        taskBody.appendChild(subtaskList);
        div.appendChild(taskBody);
        taskList.appendChild(div);
      });

		wrapper.appendChild(taskList);
		col.appendChild(wrapper);
		wrapper.style.backgroundColor = hexToRgba(parents[parent]?.color, 0.2);
		wrapper.style.borderColor = parents[parent]?.color;
    })

    // Drop-Zone
    col.ondragover = e => e.preventDefault();
    col.ondrop = e => {
  e.preventDefault();
  
  const jsonString = e.dataTransfer.getData('application/json');
  if (!jsonString) return; // kein gültiger Task-Drop → abbrechen

  try {
    const drop = JSON.parse(jsonString);
    if (drop.type === 'subtask') return;
    
    const draggedTask = tasks[drop.index];
    if (draggedTask) {
      draggedTask.status = status;
      renderBoard();
      saveBoardToFirebase();
    }
  } catch (err) {
    console.warn("Fehler beim Parsen von drop-Daten:", err);
  }
};

  });
}

function closePopup() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('popupBody').innerHTML = '';
  document.getElementById('popupButtons').innerHTML = '';
  document.getElementById('popupTitle').textContent = '';
}
function saveEdit() {
  if (!currentTask) return;

  currentTask.desc = document.getElementById('editDesc').value;
  currentTask.parent = document.getElementById('editParent').value;
  currentTask.dueDate = document.getElementById('editDueDate').value;

  saveBoardToFirebase();
  renderBoard();
  closePopup();
}

function deleteCurrent() {
  tasks = tasks.filter(t => t !== currentTask);
  renderBoard();
  saveBoardToFirebase();
  closePopup();
}

function exportData() {
	const title = document.getElementById('boardTitle').textContent;
	const data = {
	title: title,
	parents: parents,
	tasks: tasks
	};
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	let filename = document.getElementById('boardTitle').textContent.trim();
	if (!filename) filename = 'sprint-board';
	filename = filename.replace(/[^a-z0-9]/gi, '').toLowerCase(); // Dateisystem-sicher machen
	a.download = `${filename}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

// Popups

//Parent------------------------------------------------------------
function openParentEditPopup(parentName) {
  currentParentName = parentName;
  document.getElementById('parentEditName').value = parentName;
  document.getElementById('parentEditColor').value = parents[parentName]?.color || '#888';
  document.getElementById('parentEditOverlay').classList.add('show');
  document.getElementById('parentEditName').focus();
}
function closeParentEdit() {
  document.getElementById('parentEditOverlay').classList.remove('show');
}
function saveParentEditasd() {
	const newName = document.getElementById('parentEditName').value.trim();
	const newColor = document.getElementById('parentEditColor').value;
	
	if (!newName) return;
	if (newName !== currentParentName) {
		parents[newName] = { ...parents[currentParentName], color: newColor };
		delete parents[currentParentName];
		tasks.forEach(t => {
			if (t.parent === currentParentName) t.parent = newName;
		});
	}
	currentParentName = null;
	saveBoardToFirebase();
	renderBoard();
	closeParentEdit();
}

function saveParentEdit() { 
  const newName = document.getElementById('parentEditName').value.trim();
  const newColor = document.getElementById('parentEditColor').value;
  log("saveParentEdit:", "start");
  if (!newName || !currentParentName) return;
  if (newName !== currentParentName) {
    if (parents[newName]) {
      showNotification("Ein Parent mit diesem Namen existiert bereits.", "warning");
      return;
    }
    parents[newName] = {
      ...parents[currentParentName],
      color: newColor
    };
    tasks.forEach(t => {
      if (t.parent === currentParentName) t.parent = newName;
    });
    delete parents[currentParentName];
  } else {
    if (parents[newName]) {
      parents[newName].color = newColor;
    }
  }
  currentParentName = null;
  saveBoardToFirebase();
  renderBoard();
  closeParentEdit();
}


function deleteParent() {
	log("deleteParent:", "start");
	  if (!currentParent) return;
	  const confirmed = confirm(`Möchtest du das Parent-Element "${currentParent}" und alle zugehörigen Aufgaben wirklich löschen?`);
	  if (!confirmed) return;
	  delete parents[currentParent];
	  tasks = tasks.filter(t => t.parent !== currentParent);
	  currentParent = null;
	  updateParentSelect();
	  
	  saveBoardToFirebase();
	  renderBoard();
	  closeParentEdit();
}
//Task------------------------------------------------------------
function openTaskEditPopup(task) {
  currentTask = task;
  document.getElementById('taskEditDesc').value = task.desc;
  document.getElementById('taskEditDueDate').value = task.dueDate || '';

  const parentSelect = document.getElementById('taskEditParent');
  parentSelect.innerHTML = Object.keys(parents)
    .map(p => `<option value="${p}" ${task.parent === p ? 'selected' : ''}>${p}</option>`)
    .join('');
  document.getElementById('taskEditOverlay').classList.add('show');
  document.getElementById('taskEditDesc').focus();
}
function closeTaskEdit() {
  document.getElementById('taskEditOverlay').classList.remove('show');
}
function saveTaskEdit() {
  if (!currentTask) return;

  const newDesc = document.getElementById('taskEditDesc').value.trim();
  const newParent = document.getElementById('taskEditParent').value;
  const newDueDate = document.getElementById('taskEditDueDate').value;

  currentTask.desc = newDesc;
  currentTask.parent = newParent;
  currentTask.dueDate = newDueDate;

  saveBoardToFirebase();
  renderBoard();
  closeTaskEdit();
}
//Title------------------------------------------------------------
function openBoardTitlePopup() {
  const currentTitle = document.getElementById('boardTitle').textContent;
  document.getElementById('boardTitleInput').value = currentTitle;
  document.getElementById('titleEditOverlay').classList.add('show');
  document.getElementById('boardTitleInput').focus();
}
function saveBoardTitle() {
  const newTitle = document.getElementById('boardTitleInput').value.trim();
  if (newTitle) {
    document.getElementById('boardTitle').textContent = newTitle;
    localStorage.setItem('boardTitle', newTitle); // optional speicherbar
  }
  closeTitleEdit();
  saveBoardToFirebase();
}
function closeTitleEdit() {
  document.getElementById('titleEditOverlay').classList.remove('show');
}


//Task------------------------------------------------------------


function openSubtaskEditPopup_alt(task, subtaskIndex) {
  currentSubtaskTask = task;
  currentSubtaskIndex = subtaskIndex;
  const subtask = task.subtasks[subtaskIndex];
  document.getElementById('subtaskEditInput').value = subtask.desc;
  document.getElementById('subtaskEditOverlay').classList.add('show');
  document.getElementById('subtaskEditInput').focus();
}

window.openSubtaskEditPopup = function (task, subtaskIndex) {
  if (!task || typeof task !== 'object') {
    console.error("Ungültiger Task:", task);
    showNotification("Task nicht gefunden", "error");
    return;
  }

  const subtask = task.subtasks?.[subtaskIndex];
  if (!subtask || typeof subtask !== 'object') {
    console.error("Ungültiger Subtask-Index:", subtaskIndex);
    showNotification("Subtask nicht gefunden", "error");
    return;
  }

currentTask = task;
currentSubtask = subtask;
currentSubtaskIndex = subtaskIndex;
log("currentSubtask:", currentSubtask);
  document.getElementById("subtaskEditDesc").value = subtask.desc || '';
  renderSubtaskAttributeEditor(subtask);
	//document.getElementById("subtaskEditOverlay").style.display = 'flex';
	document.getElementById('subtaskEditOverlay').classList.add('show');
  setTimeout(() => {
    document.getElementById("subtaskEditDesc").focus();
  }, 50);
};

window.renderSubtaskAttributeEditor = function (subtask) {
  const container = document.getElementById("subtaskAttributeList");
  container.innerHTML = "";

  (subtask.attributes || []).forEach((attr, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'attribute-row';
    wrapper.innerHTML = `
	  <input type="text" class="attr-name" value="${attr.name}" placeholder="Name">
		<select class="attr-type">
		  <option value="string" ${attr.type === 'string' ? 'selected' : ''}>Text</option>
		  <option value="number" ${attr.type === 'number' ? 'selected' : ''}>Zahl</option>
		  <option value="boolean" ${attr.type === 'boolean' ? 'selected' : ''}>Checkbox</option>
		  <option value="date" ${attr.type === 'date' ? 'selected' : ''}>Datum</option>
		  <option value="url" ${attr.type === 'url' ? 'selected' : ''}>Link</option>
		</select>
	  <input type="${attr.type}" class="attr-value" value="${attr.value}">
`;
    container.appendChild(wrapper);
  });
};
window.addSubtaskAttribute = function () {
  if (!currentSubtask.attributes) currentSubtask.attributes = [];
  currentSubtask.attributes.push({ type: "string", name: "", value: "" });
  renderSubtaskAttributeEditor(currentSubtask);
};
window.saveSubtaskEdit = function () {
	log("saveSubtaskEdit:", "start");
	log("currentSubtask:", currentSubtask);
	const desc = document.getElementById("subtaskEditDesc").value.trim();
	const rows = document.querySelectorAll("#subtaskAttributeList .attribute-row");
	const attributes = [];
	rows.forEach(row => {
		const name = row.querySelector(".attr-name")?.value.trim();
		const type = row.querySelector(".attr-type")?.value;
		let valueRaw = row.querySelector(".attr-value")?.value;

		let value = (type === "number") ? Number(valueRaw) : valueRaw;
		if (type === "number" && isNaN(value)) value = 0;
		if (name) {
			attributes.push({ name, type, value });
		}
	});

	currentSubtask.desc = desc;
	currentSubtask.attributes = attributes;
	saveBoardToFirebase();
	renderBoard();
	closeSubtaskEdit();
};

window.saveSubtaskEdit_alt3 = function () {
	log("saveSubtaskEdit:", "start");
	log("currentSubtask:", currentSubtask);
  const desc = document.getElementById("subtaskEditDesc").value.trim();
  const attributeRows = document.querySelectorAll("#subtaskAttributeList .attribute-row");

  const updatedAttributes = [];

  attributeRows.forEach(row => {
    const nameInput = row.querySelector('input[type="text"]:not([type="number"])');
    const typeSelect = row.querySelector('select');
    const valueInput = row.querySelector('input[type="text"], input[type="number"]');

    const name = nameInput?.value?.trim();
    const type = typeSelect?.value;
    const value = type === 'number' ? Number(valueInput?.value) : valueInput?.value;
    if (name) {
      updatedAttributes.push({ name, type, value });
    }
  });
  currentSubtask.desc = desc;
  currentSubtask.attributes = updatedAttributes;

  saveBoard();
  renderBoard();
  closePopup();
};
window.saveSubtaskEdit_alt2 = function () {
  currentSubtask.desc = document.getElementById("subtaskEditDesc").value;
  saveBoard();
  renderBoard();
  closePopup();
};
function saveSubtaskEdit_alt() {
  const newDesc = document.getElementById('subtaskEditInput').value.trim();
  if (newDesc && currentSubtaskTask && currentSubtaskIndex !== null) {
    currentSubtaskTask.subtasks[currentSubtaskIndex].desc = newDesc;
    saveBoardToFirebase();
    renderBoard();
  }
  closeSubtaskEdit();
}
function closeSubtaskEdit() {
  document.getElementById('subtaskEditOverlay').classList.remove('show');
  currentSubtaskTask = null;
  currentSubtaskIndex = null;
}

function openAuthEditPopup() {
  document.getElementById('openAuthEditOverlay').classList.add('show');
  //document.getElementById('taskEditDesc').focus();
}
function closeAuthEdit(){
  document.getElementById('openAuthEditOverlay').classList.remove('show');
}
function openBoardEdit(){
  document.getElementById('boardEditOverlay').classList.add('show');
}
function closeBoardEdit(){
  document.getElementById('boardEditOverlay').classList.remove('show');
}

// Toggle Function
let allCollapsed = false;
function toggleCollapseAll() {
	log("toggleCollapseAll:", "start");
	allCollapsed = !allCollapsed;

	// Parents zusammenklappen
	document.querySelectorAll('.parent-group').forEach(group => {
	group.classList.toggle('collapsed', allCollapsed);
	});
	
  // Tasks zusammenklappen
  document.querySelectorAll('.task-body').forEach(body => {
    const btn = body.parentElement.querySelector('.task-header button');
    if (allCollapsed) {
      body.style.display = 'none';
      if (btn) btn.textContent = '⏵';
    } else {
      body.style.display = 'block';
      if (btn) btn.textContent = '⏷';
    }
  });

  // Button-Text anpassen
  const btn = document.getElementById('collapseToggleButton');
  if (btn) btn.textContent = allCollapsed ? 'Expand' : 'Collapse';
}

function isLightColor(hex) {
	//log("isLightColor:", hex);
	  const r = parseInt(hex.substr(1,2), 16);
	  const g = parseInt(hex.substr(3,2), 16);
	  const b = parseInt(hex.substr(5,2), 16);
	  const luminance = 0.299*r + 0.587*g + 0.114*b;
	  return luminance > 186;
}

function updateCurrentFileDisplay() {
	const display = document.getElementById('currentFileNameDisplay');
	if (currentFileName) {
	display.textContent = `File: ${currentFileName}`;
	} else {
	display.textContent = '';
	}
}
function showSaveMenu() {
  document.getElementById('saveMenu').classList.remove('hidden');
}

function hideSaveMenu() {
  document.getElementById('saveMenu').classList.add('hidden');
}


async function openFile() {
  try {
    [fileHandle] = await window.showOpenFilePicker({
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] }
      }]
    });

    const file = await fileHandle.getFile();
    const contents = await file.text();
    const data = JSON.parse(contents);

    // Anpassung an neue Struktur
    parents = {};

    if (data.parents) {
      // Neue Struktur (Objekt mit Farbangaben & Co.)
      for (const [key, value] of Object.entries(data.parents)) {
        if (typeof value === 'object') {
          parents[key] = {
            color: value.color || '#888',
            order: value.order ?? 0
          };
        } else {
          // Support für alte Struktur (direkter Farbwert)
          parents[key] = { color: value, order: 0 };
        }
      }
    }

    tasks = data.tasks || [];

    if (data.title) {
      document.getElementById('boardTitle').textContent = data.title;
      localStorage.setItem('sprintBoardTitle', data.title);
    }
    updateParentSelect();
    renderBoard();
    //saveBoard();
    currentFileName = fileHandle.name;
    updateCurrentFileDisplay();
	showNotification("Datei erfolgreich geladen.", "success");
  } catch (err) {
	 showNotification("Datei öffnen fehlgeschlagen.", err);
  }
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const data = JSON.parse(evt.target.result);
    parents = data.parents || {};
    tasks = data.tasks || [];

    if (data.title) {
      document.getElementById('boardTitle').textContent = data.title;
      localStorage.setItem('sprintBoardTitle', data.title); // auch lokal speichern
    }
	for (const key in parents) {
	  if (typeof parents[key] === 'string') {
		parents[key] = {
		  color: parents[key],
		  order: 0
		};
	  } else {
		if (!parents[key].color) parents[key].color = '#999';
		if (typeof parents[key].order !== 'number') parents[key].order = 0;
	  }
	}
    updateParentSelect();
    renderBoard();
    updateCurrentFileDisplay();
  };
  reader.readAsText(file);
}

async function saveNewFile() {
  const title = document.getElementById('boardTitle').textContent;
  const data = {
    title,
    parents,
    tasks
  };
  try {
    fileHandle = await window.showSaveFilePicker({
      suggestedName: `${title}.json`,
      types: [{
        description: 'JSON-Dateien',
        accept: {'application/json': ['.json']}
      }]
    });

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
	currentFileName = fileHandle.name;
	updateCurrentFileDisplay();

    alert("Datei gespeichert!");
  } catch (err) {
    console.error("Speichern abgebrochen oder fehlgeschlagen:", err);
  }
}


async function saveExistingFile() {
  if (!fileHandle) {
	showNotification("Keine Datei zum Überschreiben vorhanden. Bitte zuerst 'Open' oder 'Save as new' verwenden.","error");
    return;
  }
  const data = {
    title: document.getElementById('boardTitle').textContent,
    parents,
    tasks
  };
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    showNotification("Datei erfolgreich überschrieben.","success");
  } catch (err) {
    console.error("Fehler beim Speichern:", err);
  }

}

function showNotification(message = "Hinweis", type = "info") {
  const el = document.getElementById('notification');
  if (!el) return;

  el.textContent = message;

  // Alte Klassen entfernen
  el.className = 'notification-toast'; // Reset
  el.classList.add(type);
  el.classList.add('show');

  setTimeout(() => {
    el.classList.remove('show');
  }, 2500);
}


// 🔽 Ein bestimmtes Board laden
window.loadBoardFromFirebase = async function (boardId) {
  if (!currentUser) return;

  const ref = doc(db, "users", currentUser.uid, "boards", boardId);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    parents = data.parents || {};
    tasks = data.tasks || [];
    document.getElementById('boardTitle').textContent = data.title || boardId;
    updateParentSelect?.();
    renderBoard?.();
    showNotification(`Board '${data.title}' geladen (v:${version})`, "info");
    currentBoard = boardId;
  } else {
    showNotification(`Board '${data.title}' nicht gefunden`, "warning");
  }
};


// 🔼 Aktuelles Board speichern
window.saveBoardToFirebase = async function () {
  if (!currentUser) return;
  const boardId = currentBoard;
  console.log("Params passed to doc():", db, currentUser.uid, boardId);
  const ref = doc(db, "users", currentUser.uid, "boards", boardId);
  const data = {
    title: document.getElementById('boardTitle').textContent,
    parents,
    tasks
  };

  await setDoc(ref, data);
  showNotification(`Board '${boardId}' gespeichert`, "success");
};

window.listBoardsInFirebase_del = async function () {
  if (!currentUser) return;

  const boardList = document.getElementById('boardList');
  boardList.innerHTML = "";

  const qSnap = await getDocs(collection(db, "users", currentUser.uid, "boards"));

  if (qSnap.empty) {
    boardList.innerHTML = "<p>Keine Boards gefunden.</p>";
    return;
  }

  qSnap.forEach((docSnap) => {
    const boardId = docSnap.id;
    const btn = document.createElement('button');
    btn.textContent = boardId;
    btn.onclick = () => {
      document.getElementById('boardIdInput').value = boardId;
      window.loadBoardFromFirebase(boardId);
    };
    boardList.appendChild(btn);
  });
};
document.getElementById("boardSelect").addEventListener("change", function () {
  const selectedBoardId = this.value;
  if (selectedBoardId) {
    window.loadBoardFromFirebase(selectedBoardId);
  }
});

window.listBoardsInFirebase = async function () {
  const user = auth.currentUser;
  if (!user) return;

  const boardSelect = document.getElementById("boardSelect");
  boardSelect.innerHTML = `<option value="" disabled selected>Bitte Board wählen</option>`; // leeren

  const colRef = collection(db, "users", user.uid, "boards");
  const querySnapshot = await getDocs(colRef);

  querySnapshot.forEach((docSnap) => {
    const option = document.createElement("option");
    option.value = docSnap.id;
    option.textContent = docSnap.data().title || docSnap.id;
    boardSelect.appendChild(option);
  });
};


window.loginWithEmail = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showNotification("Eingeloggt", "success");
  } catch (err) {
    showNotification("Fehler beim Login", "error");
  }
};
window.registerWithEmail = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    showNotification("Registrierung erfolgreich", "success");
  } catch (error) {
    showNotification("Registrierung fehlgeschlagen: " + error.message, "error");
  }
};

window.logout = async function () {
  try {
    await signOut(auth);
    showNotification("👋 Erfolgreich abgemeldet", "info");

    // Optional: UI zurücksetzen
    document.getElementById("boardTitle").textContent = "Sprint Board";
    document.getElementById("boardList").innerHTML = "";
    document.getElementById("boardIdInput").value = "";
  } catch (error) {
    console.error("Logout fehlgeschlagen:", error);
    showNotification("Fehler beim Logout", "error");
  }
};

window.createNewBoard = async function () {
  const boardId = document.getElementById('boardIdInput').value.trim();

  if (!boardId) {
    showNotification("Bitte einen Boardnamen angeben", "warning");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    showNotification("Kein Benutzer angemeldet", "error");
    return;
  }

  try {
    const ref = collection(db, "users", user.uid, "boards");
    await addDoc(ref, {
      title: boardId,
      parents: {},
      tasks: []
    });
    showNotification(`Board '${boardId}' wurde angelegt`, "success");

    // Optional: direkt laden
    document.getElementById('boardIdInput').value = boardId;
    window.loadBoardFromFirebase(boardId);
    await listBoardsInFirebase?.();
  } catch (err) {
    console.error("Fehler beim Erstellen:", err);
    showNotification("Fehler beim Erstellen des Boards", "error");
  }
};

function calcSum(attributeName) {
  let sum = 0;

  tasks.forEach(task => {
    (task.subtasks || []).forEach(subtask => {
      (subtask.attributes || []).forEach(attr => {
        if (
          attr.name === attributeName &&
          (attr.type === 'number' || !isNaN(parseFloat(attr.value)))
        ) {
          sum += parseFloat(attr.value);
        }
      });
    });
  });
  return sum;
}

function renderSummaryTable() {
  const attrName = document.getElementById("summaryAttributeSelect").value;
  const container = document.getElementById("summaryTable");
  container.innerHTML = "";

  let total = 0;

  // Gruppiere nach Parent
  const groupedByParent = {};

  tasks.forEach(task => {
    (task.subtasks || []).forEach(sub => {
      (sub.attributes || []).forEach(attr => {
        if (
		  normalize(attr.name) === normalize(attrName) &&
		  !isNaN(parseFloat(attr.value))
		) {
          if (!groupedByParent[task.parent]) {
            groupedByParent[task.parent] = [];
          }
          groupedByParent[task.parent].push({
            taskDesc: task.desc,
            subtaskDesc: sub.desc,
            value: parseFloat(attr.value)
          });
        }
      });
    });
  });

  for (let parent in groupedByParent) {
    const parentBlock = groupedByParent[parent];
    let parentSum = 0;

    const title = document.createElement("h4");
    title.textContent = parent;
    container.appendChild(title);

    parentBlock.forEach(entry => {
      const line = document.createElement("div");
	  line.className = "summary-line";
      line.innerHTML = `<span>${entry.taskDesc} → ${entry.subtaskDesc}</span><span>${entry.value.toFixed(2)}</span>`;
      container.appendChild(line);
      parentSum += entry.value;
    });

    const subtotal = document.createElement("div");
    subtotal.className = "summary-subtotal";
	line.className = "summary-line";
    subtotal.style.justifyContent = "space-between";
    subtotal.style.marginTop = "0.3rem";
    subtotal.innerHTML = `<span>Summe für ${parent}:</span><span>${parentSum.toFixed(2)}</span>`;
    container.appendChild(subtotal);

    container.appendChild(document.createElement("hr"));
    total += parentSum;
  }

  const totalLine = document.createElement("div");
  totalLine.className = "summary-total";
  totalLine.style.justifyContent = "space-between";
  totalLine.style.marginTop = "1rem";
  totalLine.innerHTML = `<span>Gesamtsumme:</span><span>${total.toFixed(2)}</span>`;
  container.appendChild(totalLine);
}

function openSummaryPopup() {
  const select = document.getElementById("summaryAttributeSelect");
  select.innerHTML = "";

  const attributeNames = new Set();

  tasks.forEach(task =>
    (task.subtasks || []).forEach(sub =>
      (sub.attributes || []).forEach(attr => {
        if (attr.type === "number") attributeNames.add(normalize(attr.name));
      })
    )
  );

  if (attributeNames.size === 0) {
    showNotification("Keine numerischen Attribute gefunden", "warning");
    return;
  }

  [...attributeNames].forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });

  document.getElementById('summaryOverlay').classList.add('show');
  //renderSummaryTable();
}

function closeSummaryPopup(){
	document.getElementById('summaryOverlay').classList.add('show');
}
function normalize(str) {
  return (str || "").toLowerCase().replace(/\s+/g, "");
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    listBoardsInFirebase();
  }
});

// 🔸 Board speichern
// Optional: automatische Ladung beim Start
window.renderSummaryTable = renderSummaryTable;
window.normalize = normalize;
window.openSummaryPopup = openSummaryPopup;
window.closeSummaryPopup = closeSummaryPopup;

window.loadBoardFromFirebase = loadBoardFromFirebase;
window.saveBoardToFirebase = saveBoardToFirebase;

window.toggleEditMode = toggleEditMode;
window.toggleCollapseAll = toggleCollapseAll;
window.loadBoard = loadBoard;
window.saveBoard = saveBoard;
window.exportData = exportData;
window.importData = importData;
window.openFile = openFile;
window.saveNewFile = saveNewFile;
window.saveExistingFile = saveExistingFile;
window.showSaveMenu = showSaveMenu;
window.hideSaveMenu = hideSaveMenu;
window.updateCurrentFileDisplay = updateCurrentFileDisplay;
window.showNotification = showNotification;
window.openParentEditPopup = openParentEditPopup;
window.closeParentEdit = closeParentEdit;
window.saveParentEdit = saveParentEdit;
window.deleteParent = deleteParent;
window.openTaskEditPopup = openTaskEditPopup;
window.closeTaskEdit = closeTaskEdit;
window.saveTaskEdit = saveTaskEdit;
window.openBoardTitlePopup = openBoardTitlePopup;
window.saveBoardTitle = saveBoardTitle;
window.closeTitleEdit = closeTitleEdit;
window.openSubtaskEditPopup = openSubtaskEditPopup;
window.saveSubtaskEdit = saveSubtaskEdit;
window.closeSubtaskEdit = closeSubtaskEdit;
window.deleteCurrent = deleteCurrent;
window.toggleSubtaskDone = toggleSubtaskDone;
window.addSubtask = addSubtask;
window.editSubtask = editSubtask;
window.addTaskToParent = addTaskToParent;
window.addEmptyParentToColumn = addEmptyParentToColumn;
window.updateParentSelect = updateParentSelect;
window.hexToRgba = hexToRgba;
window.isLightColor = isLightColor;
window.listBoardsInFirebase = listBoardsInFirebase;
window.createNewBoard = createNewBoard;
window.loginWithEmail = loginWithEmail;
window.registerWithEmail = registerWithEmail;
window.logout = logout;
window.openAuthEditPopup = openAuthEditPopup;
window.closeAuthEdit = closeAuthEdit;
window.openBoardEdit = openBoardEdit;
window.closeBoardEdit = closeBoardEdit;
window.calcSum = calcSum;