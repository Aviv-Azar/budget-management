# Budget Manager

A personal, self-hosted budget tracker. Your data lives in one file on this PC (`backend/data/budget.db`) — nothing is sent anywhere.

## Running it

Double-click **`run.bat`**. It starts the server and prints two URLs:

- One to open on this PC (`http://127.0.0.1:8000`)
- One to open on your phone's browser, as long as the phone is on the **same Wi-Fi network** as this PC (`http://<this-pc's-IP>:8000`)

On your phone, open that second URL, then use "Add to Home Screen" in the browser menu so it behaves like an app icon.

Leave the `run.bat` window open while you're using the app — closing it stops the server. Press `Ctrl+C` in that window to stop it manually.

## If the app's UI code changes

Run **`rebuild-frontend.bat`** once, then restart `run.bat`.

## Backing up your data

Your data is the single file `backend/data/budget.db`. Copy it somewhere safe (cloud drive, USB) periodically — that file is your whole budget history.

## Receipt scanning requirement

The "Scan" button reads receipt photos using an OCR engine called Tesseract. It's already installed on this PC. If you ever set this app up on a different computer, you'll need to install it there too, from [github.com/UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki) (Windows installer) — everything else in this app works without it, only the receipt-photo feature needs it.
