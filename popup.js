document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("toggleExtension");
  chrome.storage.local.get("extensionEnabled", function (result) {
    button.textContent = result.extensionEnabled
      ? "Disable Extension"
      : "Enable Extension";
  });

  button.addEventListener("click", function () {
    chrome.storage.local.get("extensionEnabled", function (result) {
      const newEnabledState = !result.extensionEnabled;
      chrome.storage.local.set(
        { extensionEnabled: newEnabledState },
        function () {
          button.textContent = newEnabledState
            ? "Disable Extension"
            : "Enable Extension";
          chrome.runtime.sendMessage({
            action: newEnabledState ? "enableCopying" : "disableCopying",
          });
        }
      );
    });
  });
});
