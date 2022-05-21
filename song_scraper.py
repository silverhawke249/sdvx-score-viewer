import json
import sys

from utils import fetch_page, get_song_lookup_table, safe_open

SDVX_MUSIC_PAGE = 'https://p.eagate.573.jp/game/sdvx/vi/music/index.html'

if __name__ == '__main__':
    if any(arg in ['-h', '--help'] for arg in sys.argv[1:]):
        print(f'{sys.argv[0]} [-h | --help] [-f | -full]')
        print('    saves available song data from SDVX website to song_db.json')
        print('---')
        print('    -h or --help    displays this message.')
        print('    -f or --full    reads the entire song list.')
        print('                    without this option, reading stops upon encountering')
        print('                    a song already present in the database.')
        sys.exit()

    FULL_CHECK = any(arg in ['-f', '--full'] for arg in sys.argv[1:])

    # Load song database
    try:
        with open('song_db.json', 'r', encoding='utf-8') as f:
            music_db = json.load(f)
    except json.JSONDecodeError:
        print('Database cannot be read. Overwriting.')
        music_db = {}
    except IOError:
        print('Creating new song database file.')
        music_db = {}

    title_artist_lookup = get_song_lookup_table(music_db)
    for sid, entry in music_db.items():
        title_artist_lookup[entry['song_name'], entry['song_artist']] = sid

    new_data = []
    updated_data = []

    # Get number of pages to crawl through
    soup = fetch_page(None,
                      SDVX_MUSIC_PAGE,
                      use_post=True,
                      data={'page': 1})
    sel_element = soup.select_one('select#search_page')
    max_page = max([int(e) for e in sel_element.stripped_strings])

    for pg in range(1, max_page + 1):
        print(f'Processing page {pg}/{max_page}...', end='\r')
        soup = fetch_page(None,
                          SDVX_MUSIC_PAGE,
                          use_post=True,
                          data={'page': pg})
        music_data = soup.select('.music')

        song_in_database = False
        for music_info in music_data:
            [song_name, song_artist] = list(music_info.select_one('.info').stripped_strings)
            diff_info = music_info.select_one('.level')
            diff_dict = {e['class'][0]: int(e.string) for e in diff_info.children if hasattr(e, 'contents')}
            diffs = [None] * 5
            diff4_name = None

            song_in_database = False
            for diff_name, diff in diff_dict.items():
                if diff_name == 'nov':
                    diffs[0] = diff
                elif diff_name == 'adv':
                    diffs[1] = diff
                elif diff_name == 'exh':
                    diffs[2] = diff
                elif diff_name == 'mxm':
                    diffs[3] = diff
                else:
                    diff4_name = diff_name.upper()
                    diffs[4] = diff

            song_data = {
                'song_name': song_name,
                'song_artist': song_artist,
                'diff4_name': diff4_name,
                'difficulties': diffs
            }

            if (song_name, song_artist) in title_artist_lookup:
                # Skip song if it's a full check, otherwise stop scraping
                if FULL_CHECK:
                    sid = title_artist_lookup[song_name, song_artist]
                    if song_data == music_db[sid]:
                        continue
                    music_db[sid] = song_data
                    updated_data.append(song_data)
                else:
                    song_in_database = True
                    break
            else:
                new_data.append(song_data)
                # print(f'  Read {song_name} / {song_artist}.')

        if song_in_database:
            break

    current_id = max([int(sid) for sid in music_db], default=-1) + 1
    if music_db:
        id_list, data_list = zip(*music_db.items())
    else:
        id_list = []
        data_list = []
    for song_data in reversed(new_data):
        try:
            song_id = data_list.index(song_data)
        except ValueError:
            song_id = current_id
            current_id += 1

        music_db[song_id] = song_data

    with safe_open('song_db.json', 'w', encoding='utf-8') as f:
        json.dump(music_db, f)

    print(f'Done. Written {len(new_data)} new entry(s) to database', end='')
    if FULL_CHECK and updated_data:
        print(f', updated {len(updated_data)} entry(s) in database', end='')
    print('.')
    print()
