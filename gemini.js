// SillyManga Gemini API Handler

async function getGenerationParameters(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-preview-0514:generateContent?key=${apiKey}`;

    const requestBody = {
        "contents": [{
            "parts": [{
                "text": `Based on the following prompt, generate the parameters for a ComfyUI workflow. The parameters needed are: positive_prompt, negative_prompt, noise_seed, width, and height.

Prompt: "${prompt}"

Return the parameters in JSON format. For example:
{
  "positive_prompt": "a beautiful manga character",
  "negative_prompt": "blurry, ugly, deformed",
  "noise_seed": 123456789012345,
  "width": 512,
  "height": 768
}`
            }]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
}

async function addMangaBubbles(apiKey, imageUrl, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-preview-0514:generateContent?key=${apiKey}`;

    const requestBody = {
        "contents": [
            {
                "parts": [
                    { "text": `Add manga-style chat bubbles with text to the following image, based on this prompt: "${prompt}". Return the response as an HTML snippet with absolutely positioned divs for the bubbles. For example: <div class='sillymanga-bubble' style='top: 10px; left: 20px;'>Hello!</div>` },
                    { "url": imageUrl }
                ]
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}


export { getGenerationParameters, addMangaBubbles };
