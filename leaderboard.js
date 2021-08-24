function initialize_board() {
    // Add event listeners
	// Event listener for grouping
    for (let e of document.querySelectorAll('input[name="grouping"]')) {
        e.addEventListener('change', function() {
			document.querySelector('#leaderboard_table').setAttribute('data-page', 1);
			let navigator = document.querySelector('.navigation');
			while (navigator.children.length > 1) navigator.removeChild(navigator.lastChild);
			refresh_table();
		});
    }
	// Event listener for sorting
    for (let e of document.querySelectorAll('input[name="sorting"]')) {
        e.addEventListener('change', refresh_table);
    }
	// Event listener for pagination
	document.querySelector('#backButton').addEventListener('click', function() {
		if (this.classList.contains('disabled')) return;
		let table = document.querySelector('#leaderboard_table');
		table.setAttribute('data-page', parseInt(table.getAttribute('data-page'), 10) - 1);
		refresh_table();
	});
	document.querySelector('#nextButton').addEventListener('click', function() {
		if (this.classList.contains('disabled')) return;
		let table = document.querySelector('#leaderboard_table');
		table.setAttribute('data-page', parseInt(table.getAttribute('data-page'), 10) + 1);
		refresh_table();
	});
	document.querySelector('#pageNumber').addEventListener('keydown', function(e) {
		if (e.key === 'Enter') {
			let pgNum = parseInt(this.value, 10);
			if (isNaN(pgNum)) {
				this.value = document.querySelector('#leaderboard_table').getAttribute('data-page');
				return;
			}
			this.value = pgNum;
			let pgMax = parseInt(document.querySelector('#maxPageNumber').innerText, 10);
			pgNum = pgNum < 1 ? 1 : pgNum > pgMax ? pgMax : pgNum;
			document.querySelector('#leaderboard_table').setAttribute('data-page', pgNum);
		} else if (e.key === 'Escape') this.value = document.querySelector('#leaderboard_table').getAttribute('data-page')
		else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
			e.preventDefault();
			document.querySelector('#nextButton').click();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
			e.preventDefault();
			document.querySelector('#backButton').click();
		} else return;
		refresh_table();
	});
	// Event listener for navigator
	document.querySelector('#back_button').addEventListener('click', function() {
		if (this.classList.contains('disabled')) return;
		document.querySelector('.navigation').removeChild(document.querySelector('.navigation').lastElementChild);
		refresh_table();
	});
	document.querySelector('.navigation').firstElementChild.addEventListener('click', function() {
		while (this.parentNode.lastElementChild !== this)
			this.parentNode.removeChild(this.parentNode.lastElementChild);
		refresh_table();
	});

	document.LocalScoreViewer_searchPool = [];
    load_data_list();

    banners();  // random backgrounds
}

function load_data_list() {
    fetch('song_db.json')
        .then(response => response.json())
        .then(json => document.LocalScoreViewer_songData = json)
		.then(process_data);
    fetch('scores/profile_list.json')
        .then(response => response.json())
        .then(json => load_data(json));
}

function load_data(idlist) {
	let invalid_entries = 0;
	let cardData = {}

    for (let sdvx_id of idlist) {
        fetch(`scores/${sdvx_id}.json`)
            .then(response => response.json())
            .then(function(json) {
				cardData[sdvx_id] = json;
            })
            .catch(function(err) {
                console.log(`loading ${sdvx_id}.json failed: ${err}`);
                invalid_entries += 1;
            })
            .then(function() {
                if (Object.keys(cardData).length < (idlist.length - invalid_entries)) return;
				document.LocalScoreViewer_cardData = cardData
				process_data();
            });
    }
}

function process_data() {
	if (document.LocalScoreViewer_cardData === undefined || document.LocalScoreViewer_songData === undefined) return;

	let cards = document.LocalScoreViewer_cardData;
	let masterScoreTable = {};
	// Prep score table
	for (const [song_id, song_data] of Object.entries(document.LocalScoreViewer_songData)) {
		masterScoreTable[song_id] = {}
		for (const i in song_data.difficulties) {
			if (song_data.difficulties !== null) masterScoreTable[song_id][i] = [];
		}
	}
	// Populate score table
	for (const sdvx_id of Object.keys(cards)) {
		let card_name = cards[sdvx_id].card_name;
		for (const chart_id of Object.keys(cards[sdvx_id].scores)) {
			let [song_id, song_diff] = chart_id.split('|');
			song_id = parseInt(song_id);
			song_diff = parseInt(song_diff);
			masterScoreTable[song_id][song_diff]?.push({
				'sdvxId': sdvx_id,
				'cardName': card_name,
				'score': cards[sdvx_id].scores[chart_id].score,
				'timestamp': cards[sdvx_id].scores[chart_id].timestamp
			});
		}
	}
	document.LocalScoreViewer_scoreData = masterScoreTable;

	refresh_table();
}

function refresh_table() {
	const difficulty = [...Array(20).keys()].map(e => `Level ${20 - e}`);
	const version = ['SOUND VOLTEX BOOTH', 'infinite infection', 'GRAVITY WARS', 'HEAVENLY HAVEN', 'VIVIDWAVE', 'EXCEED GEAR'];
	const title = [...Array(26).keys()].map(e => String.fromCharCode(e + 65)).concat(['OTHERS']);
	const categories = [difficulty, version, title];
	const diffName = ['NOV', 'ADV', 'EXH', 'MXM'];
	const PER_PAGE_ENTRIES = 20;

	let selected_category = parseInt(document.querySelector('input[name="grouping"]:checked').value, 10);
	let scrollOffset = window.scrollY;
	let table = document.querySelector('#leaderboard_table');
	table.classList.remove('hidden');
	table.innerHTML = '';

	let navPath = [...document.querySelectorAll('.navigation>div[data-path]')].map(x => x.getAttribute('data-path'));
	if (navPath.length === 0) {
		document.querySelector('#back_button').classList.add('disabled');
		if (selected_category === 0) {
			table.setAttribute('data-pagination-enabled', '1');
			let entries = [...Object.entries(document.LocalScoreViewer_songData)];
			let pg = parseInt(table.getAttribute('data-page'), 10) - 1;
			entries = table_sort(entries);
			document.LocalScoreViewer_searchPool = entries;
			document.querySelector('#maxPageNumber').innerText = Math.ceil(entries.length / PER_PAGE_ENTRIES);
			for (const [song_id, song_data] of entries.slice(pg * PER_PAGE_ENTRIES, (pg + 1) * PER_PAGE_ENTRIES)) {
				let node = new_element('div', ['entry']);
				let entryWrapper = new_element('div', ['entry-container']);
				let titleDiv = new_element('div', ['song-title']);
				let artistDiv = new_element('div', ['song-artist']);
				node.setAttribute('data-display', song_data.song_name);
				node.setAttribute('data-value', song_id);
				node.addEventListener('click', entry_click);
				titleDiv.innerText = song_data.song_name;
				artistDiv.innerText = song_data.song_artist;
				entryWrapper.appendChild(titleDiv);
				entryWrapper.appendChild(artistDiv);
				node.appendChild(entryWrapper);
				table.appendChild(node);
				// overflow check
				if (titleDiv.clientWidth > 752) {
					titleDiv.style.transform = `scaleX(${752/titleDiv.clientWidth})`
				}
				if (artistDiv.clientWidth > 752) {
					artistDiv.style.transform = `scaleX(${752/artistDiv.clientWidth})`
				}
			}
		} else {
			document.LocalScoreViewer_searchPool = [];
			table.setAttribute('data-page', 1);
			table.setAttribute('data-pagination-enabled', '0');
			for (const [idx, text] of categories[selected_category - 1].entries()) {
				let node = new_element('div', ['entry']);
				let textDiv = new_element('div', ['category-name']);
				node.setAttribute('data-display', text);
				node.setAttribute('data-value', idx);
				node.addEventListener('click', entry_click);
				textDiv.innerText = text;
				node.appendChild(textDiv);
				table.appendChild(node);
			}
		}
	} else if (navPath.length === 1) {
		document.querySelector('#back_button').classList.remove('disabled');
		if (selected_category === 0) {
			document.LocalScoreViewer_searchPool = [];
			table.setAttribute('data-pagination-enabled', '0');
			let pathValue = navPath[0];
			let song_data = document.LocalScoreViewer_songData[pathValue];
			for (const [difn] of song_data.difficulties.entries()) {
				if (!song_data.difficulties[difn]) continue;
				let node = new_element('div', ['entry']);
				let difImg = new_element('img');
				let entryWrapper = new_element('div', ['entry-container']);
				let titleDiv = new_element('div', ['song-title']);
				let artistDiv = new_element('div', ['song-artist']);
				node.setAttribute('data-display', '');
				node.setAttribute('data-value', `${pathValue},${difn}`);
				node.setAttribute('data-special', '0');
				node.setAttribute('data-special-value', difn === '4' ? song_data.diff4_name : diffName[difn]);
				node.addEventListener('click', entry_click);
				if (difn === 4) difImg.src = `images/diff${song_data.diff4_name}.png`
				else difImg.src = `images/diff${diffName[difn]}.png`;
				titleDiv.innerText = song_data.song_name;
				artistDiv.innerText = song_data.song_artist;
				entryWrapper.appendChild(titleDiv);
				entryWrapper.appendChild(artistDiv);
				node.appendChild(entryWrapper);
				node.appendChild(difImg);
				table.appendChild(node);
				// overflow check
				if (titleDiv.clientWidth > 667) {
					titleDiv.style.transform = `scaleX(${667/titleDiv.clientWidth})`
				}
				if (artistDiv.clientWidth > 667) {
					artistDiv.style.transform = `scaleX(${667/artistDiv.clientWidth})`
				}
			}
		} else {
			table.setAttribute('data-pagination-enabled', '1');
			if (selected_category === 1) {
				let entries = [...Object.entries(document.LocalScoreViewer_songData)];
				let pathValue = 20 - parseInt(navPath[0], 10);
				let pg = parseInt(table.getAttribute('data-page'), 10) - 1;
				entries = entries.filter(x => x[1].difficulties.some(y => y === pathValue));
				entries = table_sort(entries);
				document.LocalScoreViewer_searchPool = entries;
				document.querySelector('#maxPageNumber').innerText = Math.ceil(entries.length / PER_PAGE_ENTRIES);
				for (const [song_id, song_data] of entries.slice(pg * PER_PAGE_ENTRIES, (pg + 1) * PER_PAGE_ENTRIES)) {
					for (const [difn, difLv] of song_data.difficulties.entries()) {
						if (difLv !== pathValue) continue;
						let node = new_element('div', ['entry']);
						let difImg = new_element('img');
						let entryWrapper = new_element('div', ['entry-container']);
						let titleDiv = new_element('div', ['song-title']);
						let artistDiv = new_element('div', ['song-artist']);
						node.setAttribute('data-display', song_data.song_name);
						node.setAttribute('data-value', `${song_id},${difn}`);
						node.setAttribute('data-special', '0');
						node.setAttribute('data-special-value', difn === 4 ? song_data.diff4_name : diffName[difn]);
						node.addEventListener('click', entry_click);
						if (difn === 4) difImg.src = `images/diff${song_data.diff4_name}.png`
						else difImg.src = `images/diff${diffName[difn]}.png`;
						titleDiv.innerText = song_data.song_name;
						artistDiv.innerText = song_data.song_artist;
						entryWrapper.appendChild(titleDiv);
						entryWrapper.appendChild(artistDiv);
						node.appendChild(entryWrapper);
						node.appendChild(difImg);
						table.appendChild(node);
						// overflow check
						if (titleDiv.clientWidth > 667) {
							titleDiv.style.transform = `scaleX(${667/titleDiv.clientWidth})`
						}
						if (artistDiv.clientWidth > 667) {
							artistDiv.style.transform = `scaleX(${667/artistDiv.clientWidth})`
						}
					}
				}
			} else if (selected_category === 2) {
				// Not implemented
			} else if (selected_category === 3) {
				let entries = [].concat(...Object.entries(document.LocalScoreViewer_songData).map(function(a) {
					let out = [];
					for (const [difn, difLv] of a[1].difficulties.entries()) {
						if (difLv === null) continue;
						out.push([a[0], a[1], difn, difLv]);
					}
					out.reverse();
					return out;
				}));
				let pathValue = parseInt(navPath[0], 10);
				let pg = parseInt(table.getAttribute('data-page'), 10) - 1;
				if (pathValue !== 26)
					entries = entries.filter(x => x[1].song_name.toUpperCase().startsWith(title[pathValue]))
				else
					entries = entries.filter(x => (/^[^a-zA-Z]/).test(x[1].song_name));
				entries = table_sort(entries);
				document.LocalScoreViewer_searchPool = entries;
				document.querySelector('#maxPageNumber').innerText = Math.ceil(entries.length / PER_PAGE_ENTRIES);
				for (const [song_id, song_data, difn, difLv] of entries.slice(pg * PER_PAGE_ENTRIES, (pg + 1) * PER_PAGE_ENTRIES)) {
					if (difLv === null) continue;
					let node = new_element('div', ['entry']);
					let difImg = new_element('img');
					let entryWrapper = new_element('div', ['entry-container']);
					let titleDiv = new_element('div', ['song-title']);
					let artistDiv = new_element('div', ['song-artist']);
					node.setAttribute('data-display', song_data.song_name);
					node.setAttribute('data-value', `${song_id},${difn}`);
					node.setAttribute('data-special', '0');
					node.setAttribute('data-special-value', difn === 4 ? song_data.diff4_name : diffName[difn]);
					node.addEventListener('click', entry_click);
					if (difn === 4) difImg.src = `images/diff${song_data.diff4_name}.png`
					else difImg.src = `images/diff${diffName[difn]}.png`;
					titleDiv.innerText = song_data.song_name;
					artistDiv.innerText = song_data.song_artist;
					entryWrapper.appendChild(titleDiv);
					entryWrapper.appendChild(artistDiv);
					node.appendChild(entryWrapper);
					node.appendChild(difImg);
					table.appendChild(node);
					// overflow check
					if (titleDiv.clientWidth > 667) {
						titleDiv.style.transform = `scaleX(${667/titleDiv.clientWidth})`
					}
					if (artistDiv.clientWidth > 667) {
						artistDiv.style.transform = `scaleX(${667/artistDiv.clientWidth})`
					}
				}
			}
		}
	} else {  // navPath.length === 2
		document.LocalScoreViewer_searchPool = [];
		table.setAttribute('data-pagination-enabled', '0');
		let [sId, diffN] = navPath[1].split(',');
		let scoreData = document.LocalScoreViewer_scoreData[sId][diffN];
		if (scoreData.length === 0) {
			let container = new_element('div', ['no-score']);
			container.innerText = 'No score data found for this chart.';
			table.appendChild(container);
		} else {
			scoreData.sort(function(a, b) {
				if (a.score !== b.score) return b.score - a.score;
				if (a.timestamp === undefined && b.timestamp === undefined) return a.sdvxId > b.sdvxId ? 1 : -1;
				if (a.timestamp === undefined) return -1;
				if (b.timestamp === undefined) return 1;
				return a.timestamp - b.timestamp;
			});
			let placement = [...scoreData.keys()].map(x => x + 1);
			for (let i=0; i<placement.length - 1; i++) {
				let a = scoreData[i], b = scoreData[i+1]
				if (a.score === b.score && (a.timestamp === b.timestamp || (a.timestamp === undefined && b.timestamp === undefined)))
					placement[i+1] = placement[i];
			}
			let container = new_element('div', ['score-entry', 'header']);
			container.innerHTML += `<div>No.</div>`;
			container.innerHTML += `<div>Card name</div>`;
			container.innerHTML += `<div>Score</div>`;
			container.innerHTML += `<div>Timestamp</div>`;
			table.appendChild(container);
			for (let i=0; i<scoreData.length; i++) {
				container = new_element('div', ['score-entry']);
				container.innerHTML += `<div>${placement[i]}</div>`;
				container.innerHTML += `<div>${scoreData[i].cardName}</div>`;
				container.innerHTML += `<div>${scoreData[i].score.toLocaleString()}</div>`;
				if (scoreData[i].timestamp === undefined) {
					container.innerHTML += `<div>---</div>`;
				} else {
					let timeStr = (new Date(scoreData[i].timestamp)).toLocaleString().split(', ');
					container.innerHTML += `<div><div>${timeStr[0]}</div><div>${timeStr[1]}</div></div>`;
				}
				table.appendChild(container);
			}
		}
	}

	// Update navigator size
	let navigation = document.querySelector('.navigation');
	// overflow check
	if (navigation.clientWidth > 668) {
		navigation.style.transform = `scaleX(${668/navigation.clientWidth})`;
	} else {
		navigation.style.transform = '';
	}

	// Update pagination
	if (table.getAttribute('data-pagination-enabled') === '1') {
		document.querySelector('#pagination').classList.remove('hidden');
		// Refresh pagination text
		document.querySelector('#pageNumber').value = table.getAttribute('data-page');
		if (table.getAttribute('data-page') === '1') document.querySelector('#backButton').classList.add('disabled')
		else document.querySelector('#backButton').classList.remove('disabled');
		if (table.getAttribute('data-page') === document.querySelector('#maxPageNumber').innerText) document.querySelector('#nextButton').classList.add('disabled')
		else document.querySelector('#nextButton').classList.remove('disabled');
	} else
		document.querySelector('#pagination').classList.add('hidden');

	// Restore scroll amount
	window.scrollTo({top: scrollOffset});
}

function table_sort(list) {
	let selected_category = parseInt(document.querySelector('input[name="grouping"]:checked').value, 10);
	let selected_sort = parseInt(document.querySelector('input[name="sorting"]:checked').value, 10);
	if (selected_sort === 0)
		return list.slice().reverse()
	else if (selected_sort === 1) {
		if (selected_category === 0) return list.slice().reverse();
		if (list[0][3] === undefined) return list.slice().reverse();
		list = list.slice();
		list.sort((a, b) => b[3] - a[3]);
		return list;
	} else {  // sort 2
		list = list.slice();
		list.sort((a, b) => a[1].song_name.toUpperCase() < b[1].song_name.toUpperCase() ? -1 : 1);
		return list;
	}
}

function entry_click() {
	let navEntry = new_element('div');
	if (!this.hasAttribute('data-special'))	{
		navEntry.innerText = this.getAttribute('data-display');
	} else {
		if (this.getAttribute('data-display') !== '')
			navEntry.innerHTML = `<div>${this.getAttribute('data-display')}</div>`;
		navEntry.innerHTML += `<img src="images/diff${this.getAttribute('data-special-value')}.png">`;
	}
	navEntry.setAttribute('data-path', this.getAttribute('data-value'));
	navEntry.addEventListener('click', function() {
		while (this.parentNode.lastElementChild !== this)
			this.parentNode.removeChild(this.parentNode.lastElementChild);
		refresh_table();
	});
	document.querySelector('.navigation').appendChild(navEntry);
	refresh_table();
}