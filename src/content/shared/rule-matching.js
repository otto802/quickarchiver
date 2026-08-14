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

/* Shared rule matching helpers for the WebExtension and custom-column API. */

var QuickArchiverRuleMatching = (() => {
  function parseEmail(value) {
    if (typeof value !== "string") {
      return "";
    }

    const email = value.match(
      /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}(\.[0-9]{1,3}){3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g
    );
    return email?.at(-1) ?? "";
  }

  function getMessageHeaderValue(message, type) {
    const value = message?.[type];
    const first = typeof value === "string" ? value : value?.[0];

    if (["author", "from", "recipients", "to"].includes(type)) {
      return parseEmail(first);
    }
    return first ?? "";
  }

  function getMessageAccountId(message) {
    const folder = message?.folder;
    return message?.accountKey
      ?? folder?.accountId
      ?? folder?.server?.accountKey
      // Older/native folder objects may expose only the incoming-server key.
      // accountKey above is the authoritative nsIMsgDBHdr value.
      ?? folder?.server?.key
      ?? "";
  }

  function findMatch(string, value) {
    if (typeof string !== "string" || typeof value !== "string") {
      return false;
    }

    if (!value.startsWith("*")) {
      value = "*" + value;
    }
    if (!value.endsWith("*")) {
      value += "*";
    }

    // Escape each literal part separately so '*' remains our wildcard.
    const escaped = value
      .split("*")
      .map(part => part.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"))
      .join(".*");
    return new RegExp("^" + escaped + "$", "i").test(string);
  }

  function isSameFolder(left, right) {
    if (!left || !right) {
      return false;
    }
    if (left.id && right.id) {
      return left.id === right.id;
    }
    return left.path === right.path
      && (!left.accountId || !right.accountId
        || left.accountId === right.accountId);
  }

  function findRule(message, rules, options = {}) {
    for (const rule of rules ?? []) {
      let match = true;
      let hasActiveCriteria = false;

      if (rule.activeFrom) {
        hasActiveCriteria = true;
        match = findMatch(getMessageHeaderValue(message, "author"), rule.from);
      }
      if (match && rule.activeTo) {
        hasActiveCriteria = true;
        match = findMatch(getMessageHeaderValue(message, "recipients"), rule.to);
      }
      if (match && rule.activeSubject) {
        hasActiveCriteria = true;
        match = findMatch(getMessageHeaderValue(message, "subject"), rule.subject);
      }
      if (match && rule.activeAccount) {
        hasActiveCriteria = true;
        match = typeof rule.accountId === "string"
          && rule.accountId.length > 0
          && (options.accountId ?? getMessageAccountId(message)) === rule.accountId;
      }

      if (hasActiveCriteria && match) {
        return rule;
      }
    }

    if (options.allowDestinationFolderFallback) {
      for (const rule of rules ?? []) {
        if (!rule?.activeAccount || !rule.folder) {
          continue;
        }

        // After a cross-account move, the original source account is no
        // longer available to the column callback. Keep this fallback opt-in
        // for display only and only use it when the message is already in the
        // rule's destination.
        const criteriaWithoutAccount = {...rule, activeAccount: false};
        if (findRule(message, [criteriaWithoutAccount])
          && isSameFolder(rule.folder, message?.folder)) {
          return rule;
        }
      }
    }

    return null;
  }

  return {
    parseEmail,
    getMessageHeaderValue,
    getMessageAccountId,
    findMatch,
    findRule
  };
})();
