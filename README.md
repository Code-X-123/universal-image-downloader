# 🚀 Smart Queue Downloader

A powerful, intelligent, and automated image scraper built with Node.js.

This tool is a **Smart Search Engine** that automatically determines the best source for your keywords (Logos vs. Photos) and manages downloads via a sophisticated **Task Queue**.

![App Screenshot](screenshot.png)
*(Note: Place a screenshot of your app in the project folder and name it screenshot.png)*

---

## ✨ Features

* **🧠 Smart Routing:**
    * Type `"Instagram Logo"` → Downloads Transparent PNGs (from PNGWing).
    * Type `"Cyberpunk City"` → Downloads 4K Wallpapers (from Unsplash).
* **🔄 Task Queue:** Add multiple search terms (e.g., "Cars", "Cats", "Dogs") and let them download one by one automatically.
* **💎 HD Link Hunter:** Automatically finds the highest resolution available.
* **⚙️ Controls:** Infinite Loop Mode, Debug Browser Mode, Skip, and Stop All.

---

## 📦 Prerequisites (Read First!)

Before you can run this app, you need to install **Node.js**. This is the engine that runs the code.

1.  **Download Node.js:** [Click here to download (LTS Version)](https://nodejs.org/)
2.  Install it just like any other program (Click Next, Next, Finish).
3.  **Verify:** Open your Command Prompt (cmd) and type the following. If you see a version number (like `v18.x.x`), you are ready!
    ```bash
    node -v
    ```

---

## 🛠️ Installation Guide (Step-by-Step)

Follow these steps to set up the project on your computer.

### Step 1: Download the Code
1.  Click the **Green "Code" button** on this GitHub page.
2.  Select **Download ZIP**.
3.  Extract the ZIP file to a folder on your computer (e.g., `D:\Smart-Downloader`).

### Step 2: Install Libraries (The Important Part)
This project relies on 3 external libraries. You need to install them once.

1.  Open the folder where you extracted the code.
2.  Click in the address bar at the top of the folder window, type `cmd`, and press **Enter**. (This opens a black terminal window inside that folder).
3.  Copy and paste the following command into the terminal and press **Enter**:

    ```bash
    npm install express socket.io puppeteer
    ```

> **What is happening?**
> * `npm` is the Node Package Manager.
> * It is downloading **Express** (for the server), **Socket.io** (for the real-time UI), and **Puppeteer** (the browser bot).
> * *Note: This might take a minute because Puppeteer downloads a version of Chrome.*

---

## 🚀 How to Run the App

There are two ways to start the app.

### Option 1: The Easy Way (Windows Only)
Double-click the file named **`Restart.vbs`**.
* This will automatically start the server and open your default web browser to the app.

### Option 2: The Manual Way
1.  Open your terminal/command prompt in the project folder.
2.  Type the following command:
    ```bash
    node server.js
    ```
3.  Open your web browser (Chrome, Edge, etc.) and go to:
    `http://localhost:3000`

---

## 📂 Project Structure

Here is what the files in your folder do:

* **`server.js`**: The Brain. This contains all the logic for scraping, the queue system, and smart routing.
* **`public/index.html`**: The Face. This is the dashboard you see in your browser.
* **`Restart.vbs`**: A shortcut script to launch the app quickly.
* **`downloads/`**: This folder is created automatically. All your images appear here.
* **`history.json`**: Saves your past searches automatically.

---

## ❓ Troubleshooting

**Q: The download isn't starting?**
* **A:** Make sure you clicked "Show Browser (Debug Mode)" to see if the bot is stuck on a CAPTCHA or cookie popup.

**Q: I get an error "Cannot find module..."**
* **A:** You skipped **Step 2** of the installation. Run `npm install express socket.io puppeteer` again.

**Q: It searches for logos but gives me photos.**
* **A:** The Smart Router looks for keywords like "logo", "icon", "png", or "symbol". Make sure your search includes one of those words (e.g., "Facebook **Logo**").

---

## 🤝 Contributing

Feel free to fork this project! If you find a new website that is good for scraping, add it to the `getSmartUrl` function in `server.js` and submit a Pull Request.

**License:** MIT