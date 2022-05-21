import os

from contextlib import contextmanager
from typing import Union

import requests

from bs4 import BeautifulSoup

K_HOST = 'https://p.eagate.573.jp'
K_EAGATE_MYPAGE = K_HOST + '/gate/p/mypage/index.html'
K_LOGIN_PAGE_ENDPOINT = K_HOST + '/gate/p/login.html'
K_LOGIN_ENDPOINT = 'https://account.konami.net/auth/login.html'


@contextmanager
def safe_open(fn, *args, **kwargs):
    try:
        os.replace(fn, f'{fn}.bak')
    except FileNotFoundError:
        pass

    try:
        with open(fn, *args, **kwargs) as f:
            yield f
    finally:
        pass


def get_play_count(s: str):
    try:
        return int(s)
    except ValueError:
        return None


def get_skill_level(s: str):
    try:
        return int(s[6:])
    except ValueError:
        return 12


def split_skill_string(s: str):
    s_split = s.split('.')
    if len(s_split) == 1:
        return 0, 'N/A'
    skill_lv, skill_name = s_split[0], '.'.join(s_split[1:])
    return skill_lv[2:], skill_name


def get_song_lookup_table(song_db: dict) -> dict:
    """ Return a reverse lookup table for song name/artist pair. """
    lookup = {}
    for sid, song_data in song_db.items():
        sn, sa = song_data['song_name'], song_data['song_artist']
        lookup[sn, sa] = sid

    return lookup


def fetch_page(session: Union[requests.Session, None], url: str, use_post=False, **kwargs) -> BeautifulSoup:
    """ Fetch a page, using Shift-JIS encoding. """
    if session is None:
        session = requests.Session()

    exception_happened = True
    while exception_happened:
        try:
            if use_post:
                r = session.post(url, **kwargs)
            else:
                r = session.get(url, **kwargs)
        except requests.exceptions.ConnectionError:
            continue
        else:
            exception_happened = False
    r.encoding = 'shift-jis'
    return BeautifulSoup(r.text, 'html5lib')


def login_routine(user_id: str, user_pw: str) -> requests.Session:
    """ Return session object, logged in using provided credentials. """
    s = requests.Session()
    s.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:98.0) Gecko/20100101 Firefox/98.0'
    s.get(K_HOST)

    # Get login URL
    r = s.get(K_LOGIN_PAGE_ENDPOINT, allow_redirects=False)
    login_url = r.headers['Location']

    r = s.get(login_url, allow_redirects=False)
    login_page_url = r.headers['Location']

    r = s.get(login_page_url, allow_redirects=False)

    soup = BeautifulSoup(r.text, 'html5lib')
    csrf_token_element = soup.select_one('section.login input[name=csrfmiddlewaretoken]')
    csrf_token = csrf_token_element['value']

    # Send login request
    s.post(
        K_LOGIN_ENDPOINT,
        data={
            'userId': user_id,
            'password': user_pw,
            'csrfmiddlewaretoken': csrf_token,
            'otpass': ''
        }
    )

    r = s.get(
        K_EAGATE_MYPAGE,
        allow_redirects=False
    )

    return s
