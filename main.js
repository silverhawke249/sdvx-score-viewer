// TODO:
//   - [DONE] Add averages/summary window
//   - [DONE] Calculate volforce
//   - [DONE] possibly display volforce charts too?
//   - [DONE] refactor to make code flow better
//   - [DONE] use cookie to store last used filter settings
//   - [DONE] implement manual wrapping via JS

const filter_fields = {
    diff: [...Array(5).keys()],
    level: [...Array(21).keys()],
    status: [...Array(5).keys()],
    grade: [...Array(10).keys()]
};
const const_names = {
    diff: ['NOV', 'ADV', 'EXH', 'MXM'],
    diff4: ['INF', 'GRV', 'HVN', 'VVD'],
    status: ['PLAYED', 'COMP', 'EX COMP', 'UC', 'PERFECT'],
    grade: ['D', 'C', 'B', 'A', 'A+', 'AA', 'AA+', 'AAA', 'AAA+', 'S']
};
const vf_multiplier = {
    status: [0.5, 1.0, 1.02, 1.05, 1.1],
    grade: [0.79, 0.82, 0.85, 0.88, 0.91, 0.94, 0.97, 1.0, 1.02, 1.05]
};

// Table of functions that convert a table entry into a HTML node
const table_columns = ['song_name', 'diff', 'level', 'status', 'grade', 'score'];
const values_to_node = {
    song_name: function(e) {
        let container = document.createElement('div');
        let sn = document.createElement('div');
        sn.innerText = e.song_name;
        container.appendChild(sn);
        /* Not putting this in until I figure out what to do when the artist field is too long
        sn.classList.add('cell-main');
        let sa = document.createElement('div');
        sa.innerText = e.song_artist;
        sa.classList.add('cell-sub');
        container.appendChild(sa);
        */
        return container;
    },
    diff: function(e) {
        let el = document.createElement('img');
        el.setAttribute('draggable', 'false');
        el.classList.add('diff');
        let diff = e.diff === 4 ? e._diff4 : const_names.diff[e.diff];
        el.src = `images/diff${diff}.png`;
        el.alt = diff;
        return el;
    },
    status: function(e) {
        let el = document.createElement('img');
        el.setAttribute('draggable', 'false');
        el.src = `images/status${e.status}.png`;
        el.alt = const_names.status[e.status];
        return el;
    },
    grade: function(e) {
        let el = document.createElement('img');
        el.setAttribute('draggable', 'false');
        el.src = `images/grade${e.grade}.png`;
        el.alt = const_names.grade[e.grade];
        return el;
    },
    score: function(e) {
        let container = document.createElement('div');
        let cs = document.createElement('div');
        let inc = document.createElement('div');
        cs.innerText = e.score.toLocaleString();
        cs.classList.add('cell-main');
        container.appendChild(cs);
        if (e.prev_data !== undefined) {
            inc.innerText = '+' + (e.score - e.prev_data.score).toLocaleString();
            inc.classList.add('cell-sub');
            container.appendChild(inc);
        }
        return container;
    },
};

function initialize() {
    // Add event listeners
    // Event listener for hiding the Statistics section
    let e = document.querySelector('.section-header');
    document.getElementById('section_stats').style.height = `${e.clientHeight}px`;
    e = document.querySelector('#section_stats>.section-header');
    e.addEventListener('click', function() {
        let parent = this.parentNode;
        if (this.classList.contains('hide-content')) {
            this.classList.remove('hide-content');
            this.classList.add('show-content');
            let cur_height = parent.clientHeight - 20;
            parent.style.height = 'auto';
            let target_height = parent.clientHeight - 20;
            parent.style.height = `${cur_height}px`;
            setTimeout(() => parent.style.height = `${target_height}px`, 10);
        } else {
            this.classList.remove('show-content');
            this.classList.add('hide-content');
            parent.style.height = `${this.clientHeight}px`;
        }
    });
    // Event listener for sorting the main table
    for (let e of document.getElementsByTagName('th')) {
        e.addEventListener('click', apply_sort);
    }
    // Event listener for the filter checkboxes
    for (let e of document.querySelectorAll('input[type="checkbox"]')) {
        e.addEventListener('change', checkbox_listener);
    }
    // Event listener for the apply filter button
    for (let e of document.querySelectorAll('input[type="button"]')) {
        if (e.hasAttribute('data-filter')) {
            e.addEventListener('click', change_filter);
        }
    }

    load_filter();
    load_card_info();

    banners(); // random backgrounds
}

function banners(){
    path = `url("images/banners/` + Math.floor(Math.random() * 10) + `.png")`;
    let bg = document.getElementById("topheader").style;
    bg.backgroundImage = path;
}

function load_filter() {
    // Get cookie
    let cookie_array = document.cookie.split(';');
    cookie_array = cookie_array.map(s => s.trim());
    let key_name = 'enabledFilters';
    let enabled_filter = null;
    for (let i=0; i<cookie_array.length; i++) {
        if (cookie_array[i].startsWith(`${key_name}=`)) {
            enabled_filter = parseInt(cookie_array[i].substring(key_name.length + 1));
            break;
        }
    }

    // Load filter value to cookie
    let filter_checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    if (enabled_filter !== null) {
        for (let checkbox of filter_checkboxes) {
            checkbox.checked = enabled_filter & 1;
            enabled_filter = Math.floor(enabled_filter / 2);
            if (enabled_filter === 0) break;
        }
    }
}

function load_card_info() {
    fetch('song_db.json')
        .then(response => response.json())
        .then(json => document.LocalScoreViewer_songData = json);
    fetch('scores/profile_list.json')
        .then(response => response.json())
        .then(json => populate_card_list(json));
}

function populate_card_list(idlist) {
    let form_select = document.getElementById('sdvx_id');
    for (let sdvx_id of idlist) {
        let option = document.createElement('option');
        option.value = sdvx_id;
        option.innerText = sdvx_id;
        form_select.appendChild(option);
    }
}

function load_card_data(sdvx_id) {
    fetch(`scores/${sdvx_id}.json`)
        .then(response => response.json())
        .then(json => populate_card_data(json));
}

function populate_card_data(data) {
    // Store data globally
    document.LocalScoreViewer_cardData = data;

    // Card metadata
    document.getElementById('player_name').innerText = data['card_name'];
    document.getElementById('playcount').innerText = data['play_count'] ? data['play_count'].toLocaleString() : 'N/A';
    document.getElementById('timestamp').innerText = (new Date(data['timestamp'])).toLocaleString();
    let skill_text = '';
    if (data['skill_level'] === 12) {
        skill_text = `Lv∞.　${data['skill_name']}`;
    } else {
        skill_text = `Lv${pad_num(data['skill_level'], 2)}.　${data['skill_name']}`;
    }
    document.getElementById('skill_lv').innerText = skill_text;

    // Prep the statistics secetion
    let stats_section = document.getElementById('section_stats');
    stats_section.classList.remove('hidden');
    // Ensure container is empty
    while (stats_section.childElementCount > 1) {
        stats_section.removeChild(stats_section.children[1]);
    }
    // Add tab container
    let tab_container = new_element('div', ['tab-container']);
    stats_section.appendChild(tab_container);

    // Score data
    update_score_table();

    // If I'm really worried about performance, I would loop through the scores Once
    // and populate all the stats arrays once, but I think I can afford doing it
    // multiple times, since it's only done once when the card data is loaded.

    // Stats data
    compute_statistics();

    // Score averages
    compute_averages();

    // Volforce data
    compute_volforce();

    // Minimize the stats section
    let e = document.querySelector('#section_stats .section-header');
    if (e.classList.contains('show-content')) {
        e.classList.remove('show-content');
        e.classList.add('hide-content');
        setTimeout(() => e.parentNode.style.height = `${e.clientHeight}px`, 15);
    }
}

function update_score_table() {
    if (!document.LocalScoreViewer_cardData) {
        return;
    }
    let scores = document.LocalScoreViewer_cardData['scores'];

    // Empty out the table first
    clear_table();

    // Get filter
    let is_in_table = get_filter();

    // Create table with raw data that's easier to handle
    let table_entries = [];
    for (let key in scores) {
        // If I don't do this IntelliJ will complain
        if (!scores.hasOwnProperty(key)) continue;

        let [song_id, song_diff] = key.split('|');
        let status = scores[key]['clear_mark'];
        let score = scores[key]['score'];

        song_id = parseInt(song_id);
        song_diff = parseInt(song_diff);

        let song_data = document.LocalScoreViewer_songData[song_id];
        let song_level = song_data['difficulties'][song_diff];
        let score_grade = get_grade(score);

        let table_entry = {
            'song_name': song_data['song_name'].replace('(EXIT TUNES)', ''),
            'song_artist': song_data['song_artist'],
            'diff': song_diff,
            'level': song_level,
            'status': status,
            'grade': score_grade,
            'score': score,
            'prev_data': document.LocalScoreViewer_cardData.updated_scores[key],
            '_id': song_id,
            '_diff4': song_data['diff4_name']
        };

        if (!is_in_table(table_entry)) continue;

        table_entries.push(table_entry);
    }

    // Sort table
    let table = document.getElementById('score_table');
    let sort_method = table.getAttribute('data-sort');
    if (sort_method) {
        table_entries.sort(sort_func(sort_method));
    }

    // Insert entries to table
    for (let entry of table_entries) {
        let table_row = document.createElement('tr');
        for (let col of table_columns) {
            let table_cell = document.createElement('td');
            let content = null;
            table_cell.classList.add(`column-${col}`);
            if (values_to_node.hasOwnProperty(col)) {
                content = values_to_node[col](entry);
            } else {
                content = document.createTextNode(entry[col])
            }
            table_cell.appendChild(content);
            table_row.appendChild(table_cell);
        }

        table.children[0].appendChild(table_row);
    }

    // Show table only if it's not empty
    let table_section = document.getElementById('section_table');
    if (table_entries.length) {
        document.getElementById('entry_num').innerText = table_entries.length;
        table_section.classList.remove('hidden');
    } else {
        table_section.classList.add('hidden');
    }
}

function compute_statistics() {
    let card_data = document.LocalScoreViewer_cardData;
    let song_data = document.LocalScoreViewer_songData;

    // Count all the charts
    let counter_level = {
        status: Array.from(Array(5), () => new Array(21).fill(0)),
        grade: Array.from(Array(10), () => new Array(21).fill(0))
    };
    let counter_diff = {
        status: Array.from(Array(5), () => new Array(6).fill(0)),
        grade: Array.from(Array(10), () => new Array(6).fill(0))
    };

    for (let key in card_data.scores) {
        if (!card_data.scores.hasOwnProperty(key)) continue;

        let score_data = card_data.scores[key];
        let score_grade = get_grade(score_data.score);
        let [sid, dif] = key.split('|');
        sid = parseInt(sid);
        dif = parseInt(dif);

        let lv = song_data[sid].difficulties[dif];

        counter_level.status[score_data.clear_mark][lv - 1]++;
        counter_level.grade[score_grade][lv - 1]++;
        counter_diff.status[score_data.clear_mark][dif]++;
        counter_diff.grade[score_grade][dif]++;

        // Totals (kinda hacky)
        counter_level.status[score_data.clear_mark][20]++;
        counter_level.grade[score_grade][20]++;
        counter_diff.status[score_data.clear_mark][5]++;
        counter_diff.grade[score_grade][5]++;
    }

    let level_labels = Array.from(Array(20).keys(), x => `Lv${pad_num(x, 2)}`);
    level_labels.push('Total');
    let diff_labels = [...const_names.diff.map(x => `images/diff${x}.png`), const_names.diff4.map(x => `images/diff${x}.png`)];
    diff_labels.push('Total');
    let grade_labels = Array.from(Array(5).keys(), x => `images/grade${x + 5}.png`);
    let status_labels = Array.from(Array(5).keys(), x => `images/status${x}.png`);

    // ['Volforce', 'Volforce']
    add_stats_page('LvStatus', 'Level/Status', create_stats_section(level_labels, status_labels, counter_level.status));
    add_stats_page('LvGrade', 'Level/Grade', create_stats_section(level_labels, grade_labels, counter_level.grade.slice(5)));
    add_stats_page('DifStatus', 'Diff/Status', create_stats_section(diff_labels, status_labels, counter_diff.status, true));
    add_stats_page('DifGrade', 'Diff/Grade', create_stats_section(diff_labels, grade_labels, counter_diff.grade.slice(5), true));
}

function compute_averages() {
    let card_data = document.LocalScoreViewer_cardData;
    let song_data = document.LocalScoreViewer_songData;

    let averages = Array.from(Array(20), () => new Array(2).fill(0));

    for (let key in card_data.scores) {
        if (!card_data.scores.hasOwnProperty(key)) continue;

        let score_data = card_data.scores[key];
        let [sid, dif] = key.split('|');
        sid = parseInt(sid);
        dif = parseInt(dif);

        let lv = song_data[sid].difficulties[dif];

        // Score averages
        averages[lv - 1][0] += score_data.score;
        averages[lv - 1][1]++;
    }

    // Compute the average
    averages = averages.map(s => s[1] === 0 ? 0 : Math.floor(s[0] / s[1]));

    // Create nodes
    let nodes = [];

    for (let i=0; i < 10; i++) {
        let entry_container = new_element('div', ['subsection-container']);

        for (let j=0; j < 2; j++) {
            let header = new_element('div', ['single-subheader']);
            let content = new_element('div', ['subcontent-container', 'w-200px']);

            let lv = j * 10 + i;
            header.innerText = `Lv${(lv + 1)/10 >> 0 ? '' : '0'}${lv + 1}`;
            content.innerText = averages[lv].toLocaleString();

            entry_container.appendChild(header);
            entry_container.appendChild(content);
        }
        nodes.push(entry_container);
    }

    add_stats_page('LvAvgs', 'Averages', nodes);
}

function compute_volforce() {
    let scores = document.LocalScoreViewer_cardData.scores;
    let song_db = document.LocalScoreViewer_songData;
    let temp_vf_table = [];
    let least_eligible_vf = 0;

    for (let key in scores) {
        if (!scores.hasOwnProperty(key)) continue;

        let [song_id, song_diff] = key.split('|');
        let status = scores[key]['clear_mark'];
        let score = scores[key]['score'];

        song_id = parseInt(song_id);
        song_diff = parseInt(song_diff);

        let song_data = song_db[song_id];
        let song_level = song_data['difficulties'][song_diff];
        let score_grade = get_grade(score);

        let volforce = song_level * 2 * score / 1e7 * vf_multiplier.status[status] * vf_multiplier.grade[score_grade];
        temp_vf_table.push([song_id, song_diff, Math.trunc(volforce)]);
    }

    temp_vf_table.sort(function(a, b) {
        return a[0] === b[0] ? b[1] - a[1] : b[2] - a[2];
    });

    // Capped at 50 charts
    least_eligible_vf = temp_vf_table[49][2];
    let vf_table = temp_vf_table.filter(e => e[2] >= least_eligible_vf);

    let nodes = [];
    for (let i=0; i < vf_table.length / 2; i++) {
        let entry_container = new_element('div', ['subsection-container']);

        for (let j=0; j < 2; j++) {
            let header = new_element('div', ['subcontent-container', 'volforce', 'w-300px']);
            let container = new_element('div', ['flex-cell']);
            let text_wrapper = new_element('div', ['center-text']);
            let content = new_element('div', ['subcontent-container']);

            let index = i * 2 + j;
            let entry = vf_table[index];
            if (entry === undefined) {
                entry = vf_table[index - 1];
                content.classList.add('invisible');
                header.classList.add('invisible');
            }

            let dif_img = document.createElement('img');
            if (entry[1] === 4) {
                dif_img.src = `images/diff${song_db[entry[0]].diff4_name}.png`;
            } else {
                dif_img.src = `images/diff${const_names.diff[entry[1]]}.png`;
            }

            let song_name = song_db[entry[0]].song_name.replace('(EXIT TUNES)', '');
            let text_container = new_element('span');
            text_container.innerText = song_name;
            text_wrapper.appendChild(text_container);
            content.innerText = `${entry[2]} VF`;

            container.appendChild(text_wrapper);
            container.appendChild(dif_img);
            header.appendChild(container);

            entry_container.appendChild(header);
            entry_container.appendChild(content);
        }
        nodes.push(entry_container);
    }

    let footer = new_element('div', ['volforce', 'table-footer']);
    footer.innerText = `${vf_table.length} charts in Volforce folder | Total Volforce is ${vf_table.slice(0, 50).map(e => e[2]).reduce((a, b) => a + b, 0) / 100}`;
    nodes.push(footer);

    // Resize divs to fit the spans
    add_stats_page('Volforce', 'Volforce', nodes);
    document.querySelector('[data-tabid="Volforce"]').addEventListener('click', function() {
        for (let el of document.querySelectorAll('.center-text')) {
            el.style.width = `${el.firstChild.getBoundingClientRect().width}px`;
        }
    });
}

function create_stats_section(row_labels, column_labels, cell_values, row_is_image) {
    let nodes = [];

    for (let i=0; i < row_labels.length; i++) {
        let row_text = row_labels[i];

        let container = new_element('div', ['subsection-container']);
        let header = new_element('div', ['single-subheader']);
        let content = new_element('div', ['subcontent-container']);

        if (!row_is_image || (typeof row_text === 'string' && !row_text.endsWith('.png'))) {
            header.innerText = row_text;
        } else {
            let img_links, head_img;
            if (typeof row_text === 'string') {
                img_links = [row_text];
            } else {
                img_links = row_text;
            }
            for (let img_link of img_links) {
                head_img = document.createElement('img');
                head_img.src = img_link;
                header.appendChild(head_img)
            }
        }

        for (let j=0; j < column_labels.length; j++) {
            let column_text = column_labels[j];

            let cell = new_element('div', ['flex-cell']);
            let c_head = new_element('div', ['flex-cell-head']);
            let c_content = new_element('div', ['flex-cell-content']);
            let cell_img = document.createElement('img');

            cell_img.src = column_text;
            c_head.appendChild(cell_img);
            c_content.innerText = cell_values[j][i];

            cell.appendChild(c_content);
            cell.appendChild(c_head);
            content.appendChild(cell);
        }

        container.appendChild(header);
        container.appendChild(content);
        nodes.push(container);
    }

    return nodes;
}

function add_stats_page(tab_id, tab_text, node_list) {
    // Wrap a list of nodes in a container, and insert it into the statistics section as a tab page
    let tab_container = document.querySelector('.tab-container');
    let stats_container = document.getElementById('section_stats');

    // Create new tab
    let tab_header = new_element('div', ['tab-head']);
    tab_header.innerText = tab_text;
    tab_header.setAttribute('data-tabid', tab_id);
    tab_header.addEventListener('click', function() {
        // Hide all tab pages except this one
        for (let el of document.getElementsByClassName('single-subsection')) {
            el.style.display = 'none';
        }
        document.getElementById(this.getAttribute('data-tabid')).style.display = 'initial';

        // Mark this tab as active
        for (let el of document.querySelector('.tab-container').children) {
            el.classList.remove('active-tab');
        }
        this.classList.add('active-tab');

        // Set the section height to fit this one (and that it animates with CSS)
        let container = document.getElementById('section_stats');
        if (!container.firstElementChild.classList.contains('hide-content')) {
            let cur_height = container.clientHeight - 20;
            container.style.height = 'auto';
            let target_height = container.clientHeight - 20;
            container.style.height = `${cur_height}px`;
            // Delay setting the new height by 10ms -- it doesn't animate otherwise
            setTimeout(() => container.style.height = `${target_height}px`, 10);
        }
    });
    tab_container.appendChild(tab_header);

    // Insert corresponding tab page
    let tab_page = new_element('div', ['single-subsection']);
    tab_page.id = tab_id;
    tab_page.style.display = 'none';
    for (let node of node_list) tab_page.appendChild(node);
    stats_container.appendChild(tab_page);

    // Switch to first tab
    tab_container.firstChild.click();
}

// EVENT LISTENERS //

function apply_sort() {
    let table = document.getElementById('score_table');
    let cur_sort_method = this.getAttribute('data-sortname');
    if (table.getAttribute('data-sort') === cur_sort_method) {
        this.classList.remove('normal-sort');
        this.classList.add('reverse-sort');
        table.setAttribute('data-sort', `!${cur_sort_method}`);
    } else if (table.getAttribute('data-sort') === `!${cur_sort_method}`) {
        this.classList.remove('reverse-sort');
        table.setAttribute('data-sort', '!_id');
    } else {
        let headers = Array.from(document.getElementsByTagName('th'));
        let previous_sort = headers.filter(e => e.classList.contains('normal-sort') || e.classList.contains('reverse-sort'));
        if (previous_sort.length) {
            previous_sort[0].classList.remove('normal-sort', 'reverse-sort');
        }
        this.classList.add('normal-sort');
        table.setAttribute('data-sort', cur_sort_method);
    }

    update_score_table();
}

function change_filter() {
    let key = this.getAttribute('data-filter');
    let apply_status = this.getAttribute('data-apply');
    for (e of filter_fields[key]) {
        let x = document.getElementById(key + e);
        if (x) x.checked = apply_status;
    }
    if (apply_status) {
        this.setAttribute('data-apply', '');
        this.value = 'Clear all';
    } else {
        this.setAttribute('data-apply', '1');
        this.value = 'Apply all';
    }
}

function checkbox_listener() {
    let type = this.id.match(/[a-zA-Z]*/)[0];
    let button = document.querySelector(`input[type="button"][data-filter="${type}"]`);
    let ticked_boxes = Array.from(document.querySelectorAll(`input[type="checkbox"][id^=${type}]`));
    ticked_boxes = ticked_boxes.filter(e => e.checked);
    if (ticked_boxes.length) {
        button.setAttribute('data-apply', '');
        button.value = 'Clear all';
    } else {
        button.setAttribute('data-apply', '1');
        button.value = 'Apply all';
    }

    // Get checked boxes
    let filter_checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
    let filter_value = 0;
    let val = 1;
    for (let checkbox of filter_checkboxes) {
        if (checkbox.checked) filter_value += val;
        val *= 2;
    }

    // Set cookie
    let key_name = 'enabledFilters';
    let expiry_time = new Date();
    expiry_time.setTime(expiry_time.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = `${key_name}=${filter_value}; expires=${expiry_time.toUTCString()}; path=/`;
}

// HELPER FUNCTIONS //

function get_filter() {
    // All in one function for filtering
    let filter = {};
    for (let type in filter_fields) {
        if (!filter_fields.hasOwnProperty(type)) continue;

        filter[type] = filter_fields[type].map(e => document.getElementById(type + e).checked);
    }

    return function (entry) {
        for (let type in filter_fields) {
            if (!filter_fields.hasOwnProperty(type)) continue;
            if (!filter[type][entry[type]]) return false;
        }
        return true;
    };
}

function clear_table() {
    let table = document.getElementById('score_table').children[0];
    while (table.children.length > 1) {
        table.removeChild(table.lastChild);
    }
}

function sort_func(key) {
    let invert = false;
    if (key.startsWith('!')) {
        invert = true;
        key = key.substr(1);
    }

    if (key === 'song_name') {
        return function(a, b) {
            return (a.song_name < b.song_name ? -1 : a.song_name === b.song_name ? 0 : 1) * (1 - 2 * invert);
        }
    } else {
        return function(a, b) {
            return a[key] === b[key] ? b._id - a._id : ((a[key] - b[key]) * (1 - 2 * invert));
        }
    }
}

function get_grade(score) {
    if (score >= 9900000) {
        return 9;
    } else if (score >= 9800000) {
        return 8;
    } else if (score >= 9700000) {
        return 7;
    } else if (score >= 9500000) {
        return 6;
    } else if (score >= 9300000) {
        return 5;
    } else if (score >= 9000000) {
        return 4;
    } else if (score >= 8700000) {
        return 3;
    } else if (score >= 8000000) {
        return 2;
    } else if (score >= 7000000) {
        return 1;
    } else {
        return 0;
    }
}

function pad_num(n, len) {
    let num_str = n.toString();
    let arr = Array(Math.max(0, len - num_str.length)).fill(0);
    arr.push(n);
    return arr.join('');
}

function new_element(tag, class_list) {
    if (!class_list) class_list = [];

    let el = document.createElement(tag);
    for (let cl of class_list) el.classList.add(cl);
    return el;
}
