let parents = {};
let tasks = [];
let currentTask = null;
let editMode = false;
let fileHandle = null;
let currentFileName = null;
let currentParentName = null;

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
	log("hexToRgba:", hex);
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
    saveBoard();
  }
}

function addSubtask(task) {
  const desc = prompt("Subtask hinzufügen:");
  if (desc) {
    task.subtasks = task.subtasks || [];
    task.subtasks.push({ desc, done: false });
    renderBoard();
    saveBoard();
  }
}

function editSubtask(task, subtask) {
  const newDesc = prompt("Subtask umbenennen:", subtask.desc);
  if (newDesc !== null) {
    subtask.desc = newDesc;
    renderBoard();
    saveBoard();
  }
}

function toggleSubtaskDone(taskIndex, subtaskIndex) {
  tasks[taskIndex].subtasks[subtaskIndex].done = !tasks[taskIndex].subtasks[subtaskIndex].done;
  saveBoard();
  renderBoard();
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
    saveBoard();
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

      saveBoard();
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
      saveBoard();
    }
  } catch (err) {
    console.warn("Fehler beim Parsen von drop-Daten:", err);
  }
};

  });
}

function openPopup(task) {
  currentTask = task;
  document.getElementById('popupTitle').textContent = 'Task bearbeiten';
  document.getElementById('popupBody').innerHTML = `
    <label for="editDesc">Beschreibung</label>
    <input type="text" id="editDesc" value="${task.desc}">

    <label for="editParent">Parent</label>
    <select id="editParent">
      ${Object.keys(parents).map(p =>
        `<option value="${p}" ${p === task.parent ? 'selected' : ''}>${p}</option>`
      ).join('')}
    </select>

    <label for="editDueDate">Fälligkeitsdatum</label>
    <input type="date" id="editDueDate" value="${task.dueDate || ''}">
  `;

  document.getElementById('popupButtons').innerHTML = `
    <button onclick="saveEdit()">💾 Speichern</button>
    <button onclick="closePopup()">❌ Abbrechen</button>
    <button onclick="deleteCurrent()" class="danger">🗑 Löschen</button>
  `;
  document.getElementById('overlay').classList.add('show');
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

  saveBoard();
  renderBoard();
  closePopup();
}


function saveEditalt() {
  if (currentTask) {
    const oldParent = currentTask.parent;
    const newDesc = document.getElementById('editDesc').value;
    const newParent = document.getElementById('editParent').value;
	currentTask.dueDate = document.getElementById('editDueDate').value;

    currentTask.desc = newDesc;

    if (newParent !== oldParent) {
      // Parent umbenennen:
      if (parents[oldParent] && !parents[newParent]) {
        parents[newParent] = parents[oldParent]; // Farbe übernehmen
        delete parents[oldParent];

        // Alle Tasks updaten, die zu diesem Parent gehören
        tasks.forEach(t => {
          if (t.parent === oldParent) {
            t.parent = newParent;
          }
        });
      }
    }

    updateParentSelect();
    saveBoard();
    renderBoard();
    closePopup();
  }
}


function deleteCurrent() {
  tasks = tasks.filter(t => t !== currentTask);
  renderBoard();
  saveBoard();
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
    saveBoard();
  };
  reader.readAsText(file);
}

// Popups

//Parent------------------------------------------------------------
let currentParent = null;
function openParentEditPopup(parentName) {
  currentParent = parentName;
  document.getElementById('parentEditName').value = parentName;
  document.getElementById('parentEditColor').value = parents[parentName]?.color || '#888';
  document.getElementById('parentEditOverlay').classList.add('show');
}
function closeParentEdit() {
  document.getElementById('parentEditOverlay').classList.remove('show');
}
function saveParentEdit() {
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
	saveBoard();
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
	  
	  saveBoard();
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

  saveBoard();
  renderBoard();
  closeTaskEdit();
}
//Title------------------------------------------------------------
function openBoardTitlePopup() {
  const currentTitle = document.getElementById('boardTitle').textContent;
  document.getElementById('boardTitleInput').value = currentTitle;
  document.getElementById('titleEditOverlay').classList.add('show');
}
function saveBoardTitle() {
  const newTitle = document.getElementById('boardTitleInput').value.trim();
  if (newTitle) {
    document.getElementById('boardTitle').textContent = newTitle;
    localStorage.setItem('boardTitle', newTitle); // optional speicherbar
  }
  closeTitleEdit();
}
function closeTitleEdit() {
  document.getElementById('titleEditOverlay').classList.remove('show');
}

//Task------------------------------------------------------------
let currentSubtaskTask = null;
let currentSubtaskIndex = null;
function openSubtaskEditPopup(task, subtaskIndex) {
  currentSubtaskTask = task;
  currentSubtaskIndex = subtaskIndex;
  const subtask = task.subtasks[subtaskIndex];
  document.getElementById('subtaskEditInput').value = subtask.desc;
  document.getElementById('subtaskEditOverlay').classList.add('show');
}
function saveSubtaskEdit() {
  const newDesc = document.getElementById('subtaskEditInput').value.trim();
  if (newDesc && currentSubtaskTask && currentSubtaskIndex !== null) {
    currentSubtaskTask.subtasks[currentSubtaskIndex].desc = newDesc;
    saveBoard();
    renderBoard();
  }
  closeSubtaskEdit();
}
function closeSubtaskEdit() {
  document.getElementById('subtaskEditOverlay').classList.remove('show');
  currentSubtaskTask = null;
  currentSubtaskIndex = null;
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
	log("isLightColor:", hex);
	  const r = parseInt(hex.substr(1,2), 16);
	  const g = parseInt(hex.substr(3,2), 16);
	  const b = parseInt(hex.substr(5,2), 16);
	  const luminance = 0.299*r + 0.587*g + 0.114*b;
	  return luminance > 186;
}

function toggleSaveMenu() {
  document.getElementById('saveMenu').classList.toggle('hidden');
}

function updateCurrentFileDisplay() {
	const display = document.getElementById('currentFileName');
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

    // Lade Inhalte
    parents = data.parents || {};
    tasks = data.tasks || [];
    if (data.title) {
      document.getElementById('boardTitle').textContent = data.title;
      localStorage.setItem('sprintBoardTitle', data.title);
    }

    updateParentSelect();
    renderBoard();
    saveBoard();
	currentFileName = fileHandle.name;
	updateCurrentFileDisplay();
    alert("Datei erfolgreich geladen.");
  } catch (err) {
    console.error("Datei öffnen abgebrochen oder fehlgeschlagen:", err);
  }
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

  toggleSaveMenu();
}

async function saveExistingFile() {
  if (!fileHandle) {
    alert("Keine Datei zum Überschreiben vorhanden. Bitte zuerst 'Open' oder 'Save as new' verwenden.");
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
    alert("Datei überschrieben.");
  } catch (err) {
    console.error("Fehler beim Speichern:", err);
  }

  toggleSaveMenu();
}


window.onload = () => {
  loadBoard();
  loadBoardTitle();
};