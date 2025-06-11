// SillyManga Extension

import { getGenerationParameters, addMangaBubbles } from './gemini.js';

(function () {
    const extensionName = "SillyManga";
    const extensionVersion = "1.0.0";

    // Default settings
    const defaultSettings = {
        comfyuiUrl: "http://127.0.0.1:8188",
        geminiApiKey: "",
        seed: "",
    };

    let settings = { ...defaultSettings };

    // Function to load settings
    function loadSettings() {
        const savedSettings = getExtensionSettings(extensionName);
        if (savedSettings) {
            Object.assign(settings, savedSettings);
        }
    }

    // Function to save settings
    function saveSettings() {
        setExtensionSettings(extensionName, settings);
    }

    // Function to generate image
    async function generateImage() {
        const workflow = await fetch("costiflux.json").then(res => res.json());

        // TODO: Get prompt from chat
        const prompt = "a beautiful manga character";

        const geminiParams = await getGenerationParameters(settings.geminiApiKey, prompt);

        const seed = settings.seed ? parseInt(settings.seed) : geminiParams.noise_seed;

        const params = {
            "6": { "inputs": { "text": geminiParams.positive_prompt } },
            "42": { "inputs": { "text": geminiParams.negative_prompt } },
            "25": { "inputs": { "noise_seed": seed } },
            "27": { "inputs": { "width": geminiParams.width, "height": geminiParams.height } }
        };

        Object.assign(workflow, params);

        const response = await fetch(`${settings.comfyuiUrl}/prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: workflow }),
        });

        const data = await response.json();
        const promptId = data.prompt_id;

        const ws = new WebSocket(`${settings.comfyuiUrl.replace('http', 'ws')}/ws`);
        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'executed' && message.data.prompt_id === promptId) {
                const imageUrl = `${settings.comfyuiUrl}/view?filename=${message.data.output.images[0].filename}`;
                addImageToChat(imageUrl);
            }
        };
    }

    // Function to add image to chat
    async function addImageToChat(imageUrl) {
        const prompt = "a beautiful manga character"; // TODO: get from chat
        const bubblesHtml = await addMangaBubbles(settings.geminiApiKey, imageUrl, prompt);

        const imageContainer = document.createElement('div');
        imageContainer.style.position = 'relative';
        imageContainer.style.display = 'inline-block';

        const image = document.createElement('img');
        image.src = imageUrl;
        imageContainer.appendChild(image);

        const bubbles = document.createElement('div');
        bubbles.innerHTML = bubblesHtml;
        imageContainer.appendChild(bubbles);

        // This is a placeholder for the actual SillyTavern API call
        // For now, we'll just append it to the body
        document.body.appendChild(imageContainer);
    }

    // Function to add the extension's UI elements
    function addUi() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div class="sillymanga-settings">
                <h2>SillyManga Settings</h2>
                <label for="comfyui-url">ComfyUI URL:</label>
                <input type="text" id="comfyui-url" value="${settings.comfyuiUrl}">
                <label for="gemini-api-key">Gemini API Key:</label>
                <input type="text" id="gemini-api-key" value="${settings.geminiApiKey}">
                <label for="sillymanga-seed">Seed:</label>
                <input type="text" id="sillymanga-seed" value="${settings.seed}">
                <button id="sillymanga-save">Save</button>
            </div>
            <button id="sillymanga-generate">Generate Manga</button>
        `;

        document.body.appendChild(container);

        document.getElementById('sillymanga-generate').addEventListener('click', generateImage);
        document.getElementById('sillymanga-save').addEventListener('click', () => {
            settings.comfyuiUrl = document.getElementById('comfyui-url').value;
            settings.geminiApiKey = document.getElementById('gemini-api-key').value;
            settings.seed = document.getElementById('sillymanga-seed').value;
            saveSettings();
        });
    }

    // Initialize the extension
    function init() {
        loadSettings();
        addUi();
        console.log(`${extensionName} version ${extensionVersion} loaded.`);
    }

    init();
})();
