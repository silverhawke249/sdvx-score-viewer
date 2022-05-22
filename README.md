# sdvx-score-viewer
Displays SDVX scores stored in JSON files in a meaningful way.

## Requirements
Python 3 is required, as well as the following packages:
- python-dotenv
- requests
- BeautifulSoup4

## Usage
- Create a `.env` file in the root folder. The contents must look like this, but write in your actual username and password:
```
EAGATE_USERNAME=[your KONAMI ID username]
EAGATE_PASSWORD=[your KONAMI ID password]
```
- Run `python song_scraper.py`. This produces `song_db.json` in the root folder.
- Run `python score_scraper.py SV-####-####`, where `SV-####-####` is your SDVX ID. This updates `scores/profile_list.json` and creates `scores/SV-####-####.json`. You can also provide someone else's SDVX ID, but their song data must be visible to you.
- Run `python -m http.server 8080` and visit `localhost:8080` on your browser to view your scores. Specify a different port number if port 8080 is used.

## Features
- Useful score statistics, to look at the overview of your grades and clear marks.
- Score averages across a difficulty level.
- Volforce folder
- Non-paginated, sortable, score table.

## Disclaimer
The scripts in this repo is provided as-is, with no warranties -- AKA double-check the contents of the scripts before you run third-party scripts on your PC! You may not hold me liable for any damage these scripts cause to your machine.

Most images in the `images/` directory belongs to Konami Amusement.
