let parents = {};
let tasks = [];
let currentTask = null;
let editMode = false;

function loadBoardTitle() {
  const title = localStorage.getItem('sprintBoardTitle') || 'Sprint Board';
  document.getElementById('boardTitle').textContent = title;
}

function openBoardTitlePopup() {
  const currentTitle = document.getElementById('boardTitle').textContent;
  document.getElementById('newBoardTitle').value = currentTitle;
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('editBoardTitlePopup').style.display = 'flex';
}

function saveBoardTitle() {
  const newTitle = document.getElementById('newBoardTitle').value.trim();
  if (newTitle) {
    document.getElementById('boardTitle').textContent = newTitle;
    localStorage.setItem('sprintBoardTitle', newTitle);
  }
  closePopup();
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
  const data = JSON.parse(localStorage.getItem('boardData')) || { parents: {}, tasks: [] };
  parents = data.parents;
  tasks = data.tasks;
  updateParentSelect();
  renderBoard();
}

function hexToRgba(hex, alpha = 1) {
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
    parents[name] = '#' + Math.floor(Math.random() * 16777215).toString(16);
    tasks.push({ desc: 'taskname', parent: name, status, subtasks: [] });
    updateParentSelect();
    saveBoard();
    renderBoard();
  } else if (parents[name]) {
    alert("Ein Parent mit diesem Namen existiert bereits.");
  }
}

function renderBoard() {
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
    for (let parent in grouped) {
      const wrapper = document.createElement('div');
      wrapper.className = 'parent-group';
      wrapper.style.backgroundColor = hexToRgba(parents[parent], 0.1); // 20% sichtbar = 80% transparent
		wrapper.style.borderColor = parents[parent];



      // Parent-Header mit Title, Collapse und Add
      const header = document.createElement('div');
      header.className = 'parent-title';
      header.style.borderLeftColor = parents[parent];

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
		  openParentRenamePopup(parent);
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
		
		const isLight = isLightColor(parents[parent]);
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
		  openPopup(task);
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
			openPopup(task);
		};
		subtaskList.appendChild(due);
		}
		
        (task.subtasks || []).forEach((subtask, sIdx) => {
          const sub = document.createElement('div');
          sub.className = 'subtask';
			const checkColor = hexToRgba(parents[task.parent] || '#888', 0.5);

			sub.innerHTML = `
			  <span class="subtask-text">${subtask.desc}</span>
			  <input type='checkbox' class='subtask-check' ${subtask.done ? 'checked' : ''} style="--check-bg: ${checkColor}" onchange='toggleSubtaskDone(${index}, ${sIdx})'>
			`;

          sub.onclick = (e) => { if (e.target.tagName !== 'INPUT') editSubtask(task, subtask); };
          subtaskList.appendChild(sub);
        });
			
		

        taskBody.appendChild(subtaskList);
        div.appendChild(taskBody);
        taskList.appendChild(div);
      });

      wrapper.appendChild(taskList);
      col.appendChild(wrapper);
	  wrapper.style.backgroundColor = hexToRgba(parents[parent], 0.2);
	wrapper.style.borderColor = parents[parent];
    }

    // Drop-Zone
    col.ondragover = e => e.preventDefault();
    col.ondrop = e => {
      const drop = JSON.parse(e.dataTransfer.getData('application/json'));
      if (drop.type === 'subtask') return;
      const draggedTask = tasks[drop.index];
      if (draggedTask) {
        draggedTask.status = status;
        renderBoard();
        saveBoard();
      }
    };
  });
}

function openPopup(task) {
  currentTask = task;
  document.getElementById('editDesc').value = task.desc;
  document.getElementById('editParent').value = task.parent;
  document.getElementById('editDueDate').value = task.dueDate || '';
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('editPopup').style.display = 'flex';
}

function closePopup() {
  document.getElementById('overlay').style.display = 'none';
  document.querySelectorAll('.popup').forEach(p => p.style.display = 'none');
}

function saveEdit() {
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

    updateParentSelect();
    renderBoard();
    saveBoard();
  };
  reader.readAsText(file);
}


function openParentRenamePopup(oldName) {
  const newName = prompt(`Parent "${oldName}" umbenennen in:`);
  if (newName && newName !== oldName && !parents[newName]) {
    // Farbe übernehmen
    parents[newName] = parents[oldName];
    delete parents[oldName];

    // Alle Tasks aktualisieren
    tasks.forEach(t => {
      if (t.parent === oldName) t.parent = newName;
    });

    updateParentSelect();
    saveBoard();
    renderBoard();
  } else if (parents[newName]) {
    alert("Ein Parent mit diesem Namen existiert bereits.");
  }
}

let currentParent = null;
function openParentRenamePopup(parentName) {
  currentParent = parentName;
  document.getElementById('renameParentName').value = parentName;
  document.getElementById('renameParentColor').value = parents[parentName] || '#888888';
  document.getElementById('overlay').style.display = 'block';
  document.getElementById('editParentPopup').style.display = 'flex';
}

function saveParentEdit() {
  const newName = document.getElementById('renameParentName').value.trim();
  const newColor = document.getElementById('renameParentColor').value;

  if (!newName) {
    alert("Name darf nicht leer sein.");
    return;
  }

  if (newName !== currentParent && parents[newName]) {
    alert("Ein Parent mit diesem Namen existiert bereits.");
    return;
  }

  if (newName !== currentParent) {
    // Rename parent key
    parents[newName] = newColor;
    delete parents[currentParent];
    tasks.forEach(t => {
      if (t.parent === currentParent) t.parent = newName;
    });
  } else {
    // Nur Farbe ändern
    parents[newName] = newColor;
  }

  currentParent = null;
  updateParentSelect();
  saveBoard();
  renderBoard();
  closePopup();
}

function deleteParent() {
  if (!currentParent) return;

  const confirmed = confirm(`Möchtest du das Parent-Element "${currentParent}" und alle zugehörigen Aufgaben wirklich löschen?`);
  if (!confirmed) return;

  // 1. Parent entfernen
  delete parents[currentParent];

  // 2. Alle zugehörigen Tasks entfernen
  tasks = tasks.filter(t => t.parent !== currentParent);

  currentParent = null;
  updateParentSelect();
  saveBoard();
  renderBoard();
  closePopup();
}

// Toggle Function
let allCollapsed = false;
function toggleCollapseAll() {
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
  const r = parseInt(hex.substr(1,2), 16);
  const g = parseInt(hex.substr(3,2), 16);
  const b = parseInt(hex.substr(5,2), 16);
  const luminance = 0.299*r + 0.587*g + 0.114*b;
  return luminance > 186; // Schwellenwert: >186 = hell
}

window.onload = () => {
  loadBoard();
  loadBoardTitle();
};