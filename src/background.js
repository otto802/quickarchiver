(async () => {

    messenger.WindowListener.registerChromeUrl([
        ["content", "quickarchiver", "chrome/content/"],
        ["resource", "quickarchiver", "chrome/"],
        ["locale", "quickarchiver", "en-US", "chrome/locale/en-US/"],
        ["locale", "quickarchiver", "de-DE", "chrome/locale/de-DE/"]
    ]);

    messenger.WindowListener.registerOptionsPage("chrome://quickarchiver/content/options.xhtml")

    messenger.WindowListener.registerWindow(
        "chrome://messenger/content/messenger.xhtml",
        "chrome://quickarchiver/content/quickarchiver_messenger.js");

    messenger.WindowListener.startListening();

})()