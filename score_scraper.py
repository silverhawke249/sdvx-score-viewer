import json
import os
import re
import sys
import time

from dotenv import load_dotenv

from utils import (
    fetch_page,
    get_play_count,
    get_skill_level,
    get_song_lookup_table,
    login_routine,
    safe_open,
    split_skill_string
)

K_PLAYER_PROFILEURL = 'https://p.eagate.573.jp/game/sdvx/vi/playdata/profile/index.html'
K_RIVAL_PROFILEURL  = 'https://p.eagate.573.jp/game/sdvx/vi/playdata/rival/profile.html'
K_RIVAL_SEARCHURL   = 'https://p.eagate.573.jp/game/sdvx/vi/playdata/rival/search.html'
K_PLAYER_SCOREURL   = 'https://p.eagate.573.jp/game/sdvx/vi/playdata/musicdata/index.html'
K_RIVAL_SCOREURL    = 'https://p.eagate.573.jp/game/sdvx/vi/playdata/rival/score.html'
CLEAR_MARK_TABLE    = {'play': 0, 'comp': 1, 'comp_ex': 2, 'uc': 3, 'per': 4}
load_dotenv()


def is_sdvx_id(st):
    if re.fullmatch(r'\d{8}', st):
        return f'SV-{st[:4]}-{st[4:]}'
    if re.fullmatch(r'sv-\d{4}-\d{4}', st, re.I):
        return st.upper()
    return False


if __name__ == '__main__':
    if any(arg in ['-h', '--help'] for arg in sys.argv[1:]):
        print(f'{sys.argv[0]} [-h | --help] [sdvx_id...]')
        print('    saves score information from specified SDVX IDs, provided scores are public')
        print('---')
        print('    -h or --help    displays this message.')
        print('    sdvx_id...      list of SDVX IDs to check, in SV-####-#### format or ######## format.')
        print('                    the script silently ignores inputs it does not recognize.')
        print('                    if omitted, the script will attempt to update every SDVX ID it has')
        print('                    in the database.')
        sys.exit()

    # Load config info
    uname = os.getenv('EAGATE_USERNAME')
    pword = os.getenv('EAGATE_PASSWORD')
    if len(sys.argv) > 1:
        d_ids = [is_sdvx_id(s) for s in sys.argv]
        d_ids = [s for s in d_ids if s]
    else:
        d_ids = None

    # Get session object
    session = login_routine(uname, pword)

    try:
        with open('scores/profile_list.json', 'r', encoding='utf-8') as f:
            sdvx_id_list = json.load(f)
    except json.JSONDecodeError:
        print('Database cannot be read. Overwriting.')
        sdvx_id_list = []
    except IOError:
        print('Existing data not found. Creating new file.')
        sdvx_id_list = []

    d_ids = d_ids or sdvx_id_list

    # Get this profile's SDVX ID
    soup = fetch_page(session, K_PLAYER_PROFILEURL)
    acc_sdvx_id = soup.select_one('#player_id').string

    # Load song database
    with open('song_db.json', 'r', encoding='utf-8') as f:
        song_db = json.load(f)
    id_lookup = get_song_lookup_table(song_db)

    for d_id in d_ids:
        IS_OWN_PROFILE = d_id == acc_sdvx_id

        # Get first page
        if IS_OWN_PROFILE:
            soup = fetch_page(session, f'{K_PLAYER_SCOREURL}?page=1&sort=0')
            max_page = int(soup.select('.page_num')[-1].string)
        else:
            soup = fetch_page(session, f'{K_RIVAL_SCOREURL}?rival_id={d_id}&page=1&sort_id=0&lv=1048575')
            try:
                max_page = int(soup.select('.page_num')[-1].string)
            except IndexError:
                print(f'Couldn\'t scrape ID {d_id}. Scores may not be public, or profile does not exist.')
                continue

        # Load/initialize score database
        try:
            with open(f'scores/{d_id}.json', 'r', encoding='utf-8') as f:
                player_db = json.load(f)
        except json.JSONDecodeError:
            print(f'Database cannot be read. Overwriting {d_id}.json.')
            player_db = {}
        except IOError:
            print(f'Creating new file for ID {d_id}.')
            player_db = {}

        # Get profile data
        if IS_OWN_PROFILE:
            soup = fetch_page(session, K_PLAYER_PROFILEURL)
            card_name = soup.select_one('#player_name>p:nth-child(2)').string
            play_count = soup.select_one('.profile_cnt').string
            skill_level = soup.select_one('.profile_skill')['id']
            try:
                skill_name = list(soup.select_one('.profile_skill').stripped_strings)[0]
            except IndexError:
                skill_name = 'N/A'
        else:
            soup = fetch_page(session,
                              K_RIVAL_SEARCHURL,
                              use_post=True,
                              data={'search_id': d_id, 'method': 1})
            card_name = soup.select_one('.cat .inner a').string
            play_count = 'N/A'
            skill_level, skill_name = split_skill_string(soup.select_one('dskillword').string)
        timestamp = time.time() * 1000

        player_db['card_name'] = card_name
        player_db['play_count'] = get_play_count(play_count)
        player_db['skill_level'] = get_skill_level(skill_level)
        player_db['skill_name'] = skill_name
        player_db['timestamp'] = timestamp
        player_db['scores'] = player_db.get('scores') or {}
        player_db['updated_scores'] = {}

        # Loop through pages
        scores = {}
        for pg in range(1, max_page + 1):
            print(f'Processing page {pg}/{max_page}...', end='\r')
            if IS_OWN_PROFILE:
                soup = fetch_page(session, f'{K_PLAYER_SCOREURL}?page={pg}&sort=0')
                table_rows = soup.select('.data_col')

                for row in table_rows:
                    song_name = list(row.select_one('.title').stripped_strings)[0]
                    song_artist = list(row.select_one('.artist').stripped_strings)[0]
                    song_id = id_lookup[song_name, song_artist]

                    for diff, diff_name in enumerate(['novice', 'advanced', 'exhaust', 'maximum', 'infinite']):
                        cm_img = row.select_one(f'.{diff_name} img')
                        if cm_img['src'].endswith('no.png'):
                            continue

                        scores[f'{song_id}|{diff}'] = {
                            'clear_mark': CLEAR_MARK_TABLE[cm_img['src'][47:-4]],
                            'score': int(list(row.select_one(f'.{diff_name}').stripped_strings)[0])
                        }
                    # print(f'  Read {song_name} / {song_artist}')
            else:
                soup = fetch_page(session, f'{K_RIVAL_SCOREURL}?rival_id={d_id}&page={pg}&sort_id=0&lv=1048575')
                table_rows = soup.select('#pc_table tr')[1:]

                for song_rows in zip(*[iter(table_rows)] * 6):
                    [song_name, song_artist] = list(song_rows[0].stripped_strings)
                    song_id = id_lookup[song_name, song_artist]

                    for diff, row in enumerate(song_rows[1:]):
                        score_node = row.select_one('#score_col_3') or row.select_one('#score_col_4')
                        score_node_str = list(score_node.stripped_strings)[0]

                        if not score_node:
                            print(f'{K_RIVAL_SCOREURL}?rival_id={d_id}&page={pg}&sort_id=0&lv=1048575')
                            print(row.prettify())
                            print(song_name)

                        if score_node_str != '0':
                            clear_mark_url = score_node.select_one('img')['src']
                            clear_mark = CLEAR_MARK_TABLE[clear_mark_url[47:-4]]
                            score = int(score_node_str)

                            scores[f'{song_id}|{diff}'] = {
                                'clear_mark': clear_mark,
                                'score': score
                            }
                    # print(f'  Read {song_name} / {song_artist}')
        print()

        new_entries = 0
        for key, data in scores.items():
            prev_data = player_db['scores'].get(key)
            if data != prev_data:
                # Store old score for comparison
                if prev_data:
                    player_db['updated_scores'][key] = prev_data
                else:
                    player_db['updated_scores'][key] = {'clear_mark': None, 'score': 0}
                player_db['scores'][key] = data
                new_entries += 1

        # Save data
        if new_entries:
            with safe_open(f'scores/{d_id}.json', 'w', encoding='utf-8') as f:
                json.dump(player_db, f)
            if d_id not in sdvx_id_list:
                sdvx_id_list.append(d_id)

            print(f'{new_entries} new entry(s) saved to {d_id}.json.')
        else:
            print(f'No new entries found for {d_id}.')

    sdvx_id_list.sort()
    with safe_open('scores/profile_list.json', 'w') as f:
        json.dump(sdvx_id_list, f)

print()
