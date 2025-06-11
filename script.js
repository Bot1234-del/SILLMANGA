(function () {
    const extensionName = "SillyManga";
    const extensionVersion = "1.0.0";

    // Function to log messages to the console
    function log(message) {
        console.log(`[${extensionName}] ${message}`);
    }

    // Function to show a toast message
    function showToast(message) {
        SillyTavern.Toast.info(message);
    }


    // Function to get a setting value
    function getSetting(key) {
        return SillyTavern.extensions.settings[extensionName][key];
    }

    // Main function to run when the extension is loaded
    async function onStart() {
        log("Extension started!");

        // Load the workflow
        const workflow = await fetch('/extensions/SillyManga/costiflux.json').then(res => res.json());

        // Create a button to trigger the image generation
        const button = document.createElement('button');
        button.textContent = 'Generate Manga';
        button.classList.add('sillymanga-button');
        button.addEventListener('click', () => generateImage(workflow));

        // Add the button to the UI
        document.querySelector('#send_form').prepend(button);
    }

    // Function to run when the extension is stopped
    function onStop() {
        log("Extension stopped!");
        // Your code here
    }

    // Function to get prompts from Gemini
    async function getPromptsFromGemini(message) {
        const apiKey = getSetting('geminiApiKey');
        if (!apiKey) {
            showToast("Gemini API key is not set.");
            return null;
        }

        const characterReferenceImageUrl = getSetting('characterReferenceImageUrl');
        let characterReferenceImageData = null;
        if (characterReferenceImageUrl) {
            characterReferenceImageData = await fetch(characterReferenceImageUrl).then(res => res.blob()).then(blob => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
            });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent?key=${apiKey}`;
        const parts = [{
            "text": `Based on the following message, generate a positive and a negative prompt for an anime-style image generation. The output should be a JSON object with "positive" and "negative" keys. Message: "${message}"`
        }];

        if (characterReferenceImageData) {
            parts.push({ "inline_data": { "mime_type": "image/jpeg", "data": characterReferenceImageData } });
            parts.push({ "text": "Use the provided image as a reference for the character's face." });
        }

        const requestBody = {
            "contents": [{ "parts": parts }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`Gemini API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const prompts = JSON.parse(data.candidates[0].content.parts[0].text);
            return prompts;
        } catch (error) {
            log(`Error getting prompts from Gemini: ${error.message}`);
            showToast("Failed to get prompts from Gemini.");
            return null;
        }
    }

    // Function to generate the image
    async function generateImage(workflow) {
        const lastMessage = SillyTavern.chat.getLastMessage();
        const prompts = await getPromptsFromGemini(lastMessage.mes);

        if (!prompts) {
            return;
        }

        // Modify the workflow with the new prompts
        workflow["6"].inputs.text = prompts.positive;
        workflow["42"].inputs.text = prompts.negative;

        // Call ComfyUI to generate the image
        const comfyuiUrl = getSetting('comfyuiUrl');
        const response = await fetch(`${comfyuiUrl}/prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: workflow
            }),
        });

        const data = await response.json();
        const promptId = data.prompt_id;

        // Wait for the image to be generated
        listenForImage(promptId);
        log(`Image generation started with prompt ID: ${promptId}`);
        showToast(`Image generation started!`);
    }

    // Function to listen for the generated image
    function listenForImage(promptId) {
        const comfyuiUrl = getSetting('comfyuiUrl').replace('http', 'ws');
        const socket = new WebSocket(`${comfyuiUrl}/ws?clientId=${Date.now()}`);

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'executed' && data.data.prompt_id === promptId) {
                const images = data.data.output.images;
                if (images && images.length > 0) {
                    const imageName = images[0].filename;
                    const imageUrl = `${getSetting('comfyuiUrl')}/view?filename=${imageName}`;
                    displayImage(imageUrl);
                    socket.close();
                }
            }
        };
    }

    // Function to display the image in the chat
    function displayImage(imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.classList.add('manga-image');

        const message = {
            is_user: false,
            is_name: true,
            name: "SillyManga",
            mes: img.outerHTML,
        };

        SillyTavern.chat.addMessage(message);
        addMangaText(imageUrl);
    }

    // Function to add manga text to the image
    async function addMangaText(imageUrl) {
        const apiKey = getSetting('geminiApiKey');
        if (!apiKey) {
            showToast("Gemini API key is not set.");
            return;
        }

        const imageData = await fetch(imageUrl).then(res => res.blob()).then(blob => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
        });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-06-05:generateContent?key=${apiKey}`;
        const requestBody = {
            "contents": [{
                "parts": [
                    { "text": "Add manga-style text bubbles to this image. The output should be HTML with divs for the bubbles. The user's last message was: " + SillyTavern.chat.getLastMessage().mes },
                    { "inline_data": { "mime_type": "image/jpeg", "data": imageData } }
                ]
            }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error(`Gemini API request failed with status ${response.status}`);
            }

            const data = await response.json();
            const html = data.candidates[0].content.parts[0].text;

            const message = {
                is_user: false,
                is_name: true,
                name: "SillyManga",
                mes: html,
            };

            SillyTavern.chat.addMessage(message);

        } catch (error) {
            log(`Error adding manga text: ${error.message}`);
            showToast("Failed to add manga text.");
        }
    }

    // Register the extension with SillyTavern
    if (typeof SillyTavern !== 'undefined' && SillyTavern.extensions) {
        SillyTavern.extensions.register(extensionName, extensionVersion, {
            onstart: onStart,
            onstop: onStop,
        });
    } else {
        console.error("SillyTavern object not found. Make sure you are running this script in the SillyTavern environment.");
    }
})();