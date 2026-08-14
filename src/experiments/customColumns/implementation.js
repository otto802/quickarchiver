/**
 * QuickArchiver
 * Copyright (c) 2026 Otto Berger <otto@bergerdata.de>
 *
 * QuickArchiver is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with QuickArchiver. If not, see <http://www.gnu.org/licenses/>.
 */

var { ExtensionCommon } = ChromeUtils.importESModule(
  "resource://gre/modules/ExtensionCommon.sys.mjs"
);
var { MailServices } = ChromeUtils.importESModule(
  "resource:///modules/MailServices.sys.mjs"
);
// Experiment implementations already run in Thunderbird's privileged
// parent global, where Services is exposed directly. Services.jsm and
// ChromeUtils.import() are no longer available in current Thunderbird.
var Services = globalThis.Services;

var ThreadPaneColumns;
try {
  ({ ThreadPaneColumns } = ChromeUtils.importESModule(
    "chrome://messenger/content/thread-pane-columns.mjs"
  ));
} catch (err) {
  ({ ThreadPaneColumns } = ChromeUtils.importESModule(
    "chrome://messenger/content/ThreadPaneColumns.mjs"
  ));
}

const registeredColumns = new Map();
const pendingColumns = new Map();
const ruleMatching = {};

function announceRegisteredColumns() {
  for (const id of registeredColumns.keys()) {
    Services.obs.notifyObservers(null, "custom-column-added", id);
  }
}

function registerColumnWhenReady(id, attempt = 0) {
  if (registeredColumns.has(id)) {
    pendingColumns.delete(id);
    return;
  }

  const pending = pendingColumns.get(id);
  if (!pending) {
    return;
  }

  let mailWindow = Services?.wm?.getMostRecentWindow("mail:3pane");
  if (mailWindow?.document?.readyState === "complete") {
    try {
      // The experiment global can be recreated while Thunderbird keeps the
      // ThreadPaneColumns module alive. In that case the local registry is
      // empty although Thunderbird still has the old definition. Replace it
      // before adding the fresh callback/state instead of adding the same ID.
      for (let duplicate = 0; duplicate < 10; duplicate++) {
        if (!ThreadPaneColumns.getColumn(id)) {
          break;
        }
        ThreadPaneColumns.removeCustomColumn(id);
      }
      ThreadPaneColumns.addCustomColumn(id, pending.column);
      registeredColumns.set(id, pending.state);
      pendingColumns.delete(id);
    } catch (error) {
      console.error("Could not register QuickArchiver folder column", error);
      if (attempt < 20) {
        setTimeout(() => registerColumnWhenReady(id, attempt + 1), 250);
      }
    }
    return;
  }

  if (mailWindow && !pending.windowListenerAttached) {
    pending.windowListenerAttached = mailWindow;
    mailWindow.addEventListener(
      "load",
      () => registerColumnWhenReady(id),
      {once: true}
    );
  }

  if (attempt < 20 && pendingColumns.has(id)) {
    setTimeout(() => registerColumnWhenReady(id, attempt + 1), 250);
  }
}

// A custom column registered before the 3-pane window exists is included in
// the global column list, but the window's picker does not see the
// custom-column-added notification. Re-announce once when a mail window has
// finished loading. This is deliberately kept in the experiment process so
// it cannot run once per short-lived MV3 background context or once per tab.
Services.obs.addObserver(subject => {
  let window = subject;
  if (typeof window?.QueryInterface === "function") {
    try {
      window = window.QueryInterface(Ci.nsIDOMWindow);
    } catch (error) {
      // Some Thunderbird versions already pass the window object directly.
    }
  }
  if (!window) {
    return;
  }

  const announce = () => {
    if (window.document?.documentElement?.getAttribute("windowtype") !== "mail:3pane") {
      return;
    }
    for (const id of pendingColumns.keys()) {
      registerColumnWhenReady(id);
    }
    announceRegisteredColumns();
  };

  if (window.document?.readyState === "complete") {
    announce();
  } else {
    window.addEventListener("load", announce, {once: true});
  }
}, "domwindowopened");

const mailWindows = Services.wm.getEnumerator("mail:3pane");
while (mailWindows.hasMoreElements()) {
  const window = mailWindows.getNext();
  if (window.document?.readyState === "complete") {
    announceRegisteredColumns();
  }
}

function decodeFolderText(value) {
  if (typeof value !== "string") {
    return value;
  }
  // IMAP folder paths may use modified UTF-7. For example, "&APY-" is the
  // IMAP representation of "ö". Thunderbird can expose this representation
  // for special folders even though the folder name is displayed normally in
  // the rest of the application.
  return value.replace(/&([^-]*)-/g, (match, encoded) => {
    if (encoded === "") {
      return "&";
    }

    try {
      let base64 = encoded.replace(/,/g, "/");
      let alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      let bits = 0;
      let bitCount = 0;
      let bytes = [];
      for (let character of base64) {
        let value = alphabet.indexOf(character);
        if (value < 0) {
          throw new Error("Invalid modified UTF-7 sequence");
        }
        bits = (bits << 6) | value;
        bitCount += 6;
        while (bitCount >= 8) {
          bitCount -= 8;
          bytes.push((bits >> bitCount) & 0xff);
        }
      }
      let decoded = "";
      for (let index = 0; index + 1 < bytes.length; index += 2) {
        decoded += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
      }
      return decoded;
    } catch (err) {
      return match;
    }
  });
}

function folderDisplayValue(rule, message, currentFolderText) {
  const folder = rule?.folder;
  if (!folder) {
    return "";
  }

  const mailWindow = Services?.wm?.getMostRecentWindow("mail:3pane");
  const displayedFolder = mailWindow?.gFolderDisplay?.displayedFolder;
  const currentFolder = displayedFolder ?? message?.folder ?? {};
  let targetAccount = null;
  let currentAccount = null;
  try {
    targetAccount = folder.accountId
      ? MailServices.accounts.getAccount(folder.accountId)
      : null;
    currentAccount = currentFolder.server
      ? MailServices.accounts.findAccountForServer(currentFolder.server)
      : null;
  } catch (err) {
    // Account metadata is only used to improve path context. The regular
    // folder identity comparisons remain usable without it.
  }
  const currentAccountId = currentFolder.accountId
    ?? currentAccount?.key
    ?? currentFolder.server?.key;
  const accountsDiffer = Boolean(
    folder.accountId
    && currentAccountId
    && folder.accountId !== currentAccountId
    && targetAccount?.incomingServer !== currentFolder.server
  );
  const currentFolderId = currentFolder.id ?? currentFolder.URI ?? currentFolder.uri;
  const sameFolderById = Boolean(
    folder.id && currentFolderId && folder.id === currentFolderId
  );
  const sameFolderByPath = Boolean(
    typeof folder.path === "string"
    && typeof currentFolder.path === "string"
    && folder.path === currentFolder.path
    // Some legacy rules do not have accountId. Only reject the match when
    // both values exist and explicitly point to different accounts.
    && !accountsDiffer
  );
  const targetPathParts = typeof folder.path === "string"
    ? folder.path.split("/").filter(Boolean)
    : [];
  const currentPathParts = [];
  let parent = currentFolder;
  while (parent && parent.name) {
    currentPathParts.unshift(parent.name);
    if (!parent.parent || parent.parent === parent) {
      break;
    }
    parent = parent.parent;
  }
  const nativeUriPathParts = [];
  if (typeof currentFolder.URI === "string") {
    try {
      const uri = new URL(currentFolder.URI);
      nativeUriPathParts.push(
        ...decodeURIComponent(uri.pathname).split("/").filter(Boolean)
      );
    } catch (err) {
      // Some special folders use non-standard URI schemes. The parent-folder
      // path above remains available as a fallback for those folders.
    }
  }
  const nativePathCandidates = [currentPathParts, nativeUriPathParts];
  const sameFolderByNativePath = Boolean(
    targetPathParts.length > 0
    && nativePathCandidates.some(currentPath =>
      currentPath.length >= targetPathParts.length
      && targetPathParts.every(
        (name, index) => name === currentPath[
          currentPath.length - targetPathParts.length + index
        ]
      )
    )
  );
  const sameFolderByName = Boolean(
    folder.name
    && currentFolder.name
    && folder.name === currentFolder.name
    && !accountsDiffer
  );

  if (
    sameFolderById
    || sameFolderByPath
    || sameFolderByNativePath
    || sameFolderByName
  ) {
    return currentFolderText;
  }

  const path = typeof folder.path === "string" ? folder.path : "";
  const targetFolders = path.split("/").filter(Boolean);
  if (targetFolders.length === 0) {
    return decodeFolderText(folder.name || "");
  }

  const targetName = decodeFolderText(folder.name || targetFolders.at(-1));
  let parentFolders = targetFolders.slice(0, -1).map(decodeFolderText);

  // Do not repeat the folder currently shown in the message list. For example,
  // show "Invoices (Archive)" instead of "Invoices (Inbox/Archive)" when the
  // current folder is Inbox and the rule points to Inbox/Archive/Invoices.
  const currentPath = message?.folder?.path;
  if (typeof currentPath === "string") {
    const currentFolders = currentPath.split("/").filter(Boolean);
    const isCurrentFolderParent = currentFolders.every(
      (name, index) => parentFolders[index] === name
    );
    if (isCurrentFolderParent) {
      parentFolders = parentFolders.slice(currentFolders.length);
    }
  }

  if (accountsDiffer) {
    let accountName = folder.accountId;
    try {
      accountName = targetAccount?.incomingServer?.prettyName
        || targetAccount?.incomingServer?.name
        || accountName;
    } catch (err) {
      // Keep the account id as a useful fallback for unavailable accounts.
    }
    if (accountName) {
      parentFolders.unshift(accountName);
    }
  }

  return parentFolders.length > 0
    ? `→ ${targetName} (${parentFolders.join("/")})`
    : `→ ${targetName}`;
}

var customColumns = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    if (!ruleMatching.QuickArchiverRuleMatching) {
      Services.scriptloader.loadSubScript(
        context.extension.baseURI.resolve("content/shared/rule-matching.js"),
        ruleMatching
      );
    }

    return {
      customColumns: {
        async add(id, name, rules, currentFolderText) {
          // MV3 background contexts are event pages and may be unloaded while
          // Thunderbird remains open. Keep the column registration in the
          // experiment process instead of tying it to that short-lived
          // context.
          const existing = registeredColumns.get(id);
          if (existing) {
            existing.rules = rules;
            existing.currentFolderText = currentFolderText;
            ThreadPaneColumns.refreshCustomColumn(id);
            return true;
          }

          // Several startup paths can call add() before the first delayed
          // registration has completed. Keep one pending registration per id;
          // otherwise each caller would append another column definition.
          const pending = pendingColumns.get(id);
          if (pending) {
            pending.state.rules = rules;
            pending.state.currentFolderText = currentFolderText;
            return false;
          }

          const state = { rules, currentFolderText };
          const column = {
            name,
            hidden: false,
            icon: false,
            resizable: true,
            sortable: true,
            textCallback: message => folderDisplayValue(
              ruleMatching.QuickArchiverRuleMatching.findRule(message, state.rules),
              message,
              state.currentFolderText
            ),
          };

          pendingColumns.set(id, {column, state});
          registerColumnWhenReady(id);
          return false;
        },

        async setRules(id, rules) {
          const column = registeredColumns.get(id);
          if (!column) {
            return false;
          }
          // Replace the rule list so the column never keeps a stale array
          // reference after a rule has been deleted or imported.
          column.rules = Array.isArray(rules) ? [...rules] : [];
          ThreadPaneColumns.refreshCustomColumn(id);
          return true;
        },

        async remove(id) {
          pendingColumns.delete(id);
          ThreadPaneColumns.removeCustomColumn(id);
          registeredColumns.delete(id);
        },
      },
    };
  }

  close() {
    // Do not remove columns here. In Thunderbird MV3 this API context can be
    // closed merely because the background event page went idle. The
    // experiment process owns the registration and the next background-page
    // startup will update it through add()/setRules().
  }
};
