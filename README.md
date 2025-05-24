# ActionAgent Chrome Extension

ActionAgent is a Chrome extension that logs user interactions in Chrome and, on user request, queries an LLM with the history of user interactions to provide context-aware automation. It is designed to automate everyday tasks such as downloading assets, searching for videos or music, placing orders on e-commerce platforms, and seamlessly browsing the web—empowering users to accomplish repetitive actions efficiently and effortlessly.

## Example Use Cases

ActionAgent empowers users to automate complex, multi-step workflows across the web with a single click or natural language command. For example:

- **Automate Job Applications:** Automatically fill out job application forms, upload your resume, and submit applications on multiple job portals.
- **Streamline Online Shopping:** Search for products, compare prices, add items to your cart, and complete purchases on e-commerce platforms—all hands-free.
- **Efficient Research:** Collect information from various sources, summarize articles, and organize research notes as you browse.
- **Media Management:** Find, download, and organize music or videos from different platforms based on your preferences.
- **Routine Reporting:** Log into dashboards, extract data, and compile reports without manual intervention.

By leveraging the power of LLMs and real-time user context, ActionAgent transforms repetitive browser tasks into intelligent, automated workflows—saving time, reducing errors, and boosting productivity for professionals, students, and everyday users alike.

## Directory Structure

```
ActionAgent/
├── background.js       // Background script handling API calls and message routing
├── content.js          // Content script for interacting with webpage elements
├── manifest.json       // Chrome extension manifest
├── popup.html          // Popup for user interface
├── popup.js            // Script for handling popup interactions
└── README.md           // Project Readme
```

## Setup

### 1. Configure the Cerebras API Key

Open the `background.js` file and update the API key and optional header details to match your Cerebras account:

```javascript
// Example in popup.js:
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "Authorization": "Bearer YOUR_CEREBRAS_API_KEY" 
    },
    body: JSON.stringify({ 
      model: "qwen-3-32b", 
      messages: [
        { role:"system", content: SYSTEM_PROMPT },
        { role:"user", content: `Current page log:\n${log}\n\nUser request: ${userRequest}\n\nGenerate tool calls to fulfill this request. Remember to add wait after opening tabs and use specific selectors.` },
      ]  
    })
  });
```

### 2. Load the Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click on **Load unpacked** and select the folder where the extension (ActionAgent) is located.

## How It Works

- **Background Script (`background.js`):**  
  Listens for messages from the extension’s popup or content scripts. When it receives a message of type `queryLLM`, it sends a POST request directly to the OpenRouter API endpoint with your query.
  
- **Content Script (`content.js`):**  
  Monitors webpage interactions and sends relevant actions or queries to the background script.
  
- **Popup (`popup.html` & `popup.js`):**  
  Provides a UI for users to manually input queries. When a query is submitted, it is forwarded to the background script for processing.

## Usage

1. **Send a Query:**
   - Click the ActionAgent icon to open the popup.
   - Enter a query (e.g., "What is the capital of France?") and click **Send**.
   - The background script sends the request to OpenRouter and returns the chatbot's response.

2. **Automatic Action Logging:**
   - The extension may log various actions (e.g., button clicks) on webpages and use them as triggers for additional functionality.

## Troubleshooting

- **Authentication Issues:**  
  If you receive errors like "No auth credentials found," ensure that your API key in `popup.js` is correct and has no extra quotes or whitespace.
  
- **Extension Errors:**  
  Check the Chrome Extensions page or the background script console (via chrome://extensions/) for error messages that can help diagnose issues.
