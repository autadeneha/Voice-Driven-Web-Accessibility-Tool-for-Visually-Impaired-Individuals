/**
 * VisionaryAI — Background Service Worker (minimal)
 * Only handles popup ↔ content script message relay.
 * TTS is handled directly in content scripts via Web Speech API.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VAI] Extension ready');
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'GET_STATUS') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs?.[0]) { sendResponse({ status: 'No tab', orbState: 'inactive' }); return; }
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' })
        .then(r => sendResponse(r || { status: 'Ready', orbState: 'listening' }))
        .catch(() => sendResponse({ status: 'Say Hey Vision', orbState: 'listening' }));
    });
    return true;
  }

  return false;
});
