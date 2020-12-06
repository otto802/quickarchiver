
function onLoad(isAddonActivation) {
    // Inject a XUL fragment (providing the needed DTD files as well)
    // using the injectElements helper function. The added elements
    // will be automatically removed on window unload.

    Services.scriptloader.loadSubScript("chrome://quickarchiver/content/quickarchiver_storage.js", window, "UTF-8");
    Services.scriptloader.loadSubScript("chrome://quickarchiver/content/quickarchiver.js", window, "UTF-8");

    WL.injectElements(`
    
        <popup id="mailContext">
            <menuitem
                    id="quickarchiver-context-edit"
                    label="&quickarchiverContextmenuEntryDialog;"
                    oncommand="quickarchiver.showDialogFromSelected();"/>
            <menuitem
                    id="quickarchiver-context-apply"
                    label="&quickarchiverContextmenuEntryApply;"
                    oncommand="quickarchiver.moveSelectedMail();"/>
        </popup>
        
        <stringbundleset id="stringbundleset">
        <stringbundle id="quickarchiver-strings" src="chrome://quickarchiver/locale/overlay.properties"/>
        </stringbundleset>
        <keyset id="mailKeys">
            <key id="key_quickarchiver"
                 key="&quickarchiverCmd.key;"
                 modifiers="shift"
                 oncommand="quickarchiver.moveSelectedMail();"
                    />
        </keyset>
    
          <tree id="threadTree">
            <treecols id="threadCols" inserafter="dateCol">
                <splitter class="tree-splitter"/>
                <treecol id="colQuickArchiver" persist="hidden ordinal width"
                         currentView="unthreaded" flex="2"
                         label="&quickarchiverFolderHeader;" tooltiptext="&quickarchiverFolderHeaderTooltip;"/>
            </treecols>
        </tree>
        
`, ["chrome://quickarchiver/locale/overlay.dtd"]);

    WL.injectCSS("chrome://quickarchiver/content/quickarchiver.css");
    window.quickarchiver.onLoad();
}

function onUnload(deactivatedWhileWindowOpen) {
    // Cleaning up the window UI is only needed when the
    // add-on is being deactivated/removed while the window
    // is still open. It can be skipped otherwise.
    if (!deactivatedWhileWindowOpen) {
        return
    }
}