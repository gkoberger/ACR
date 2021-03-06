/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//console.log("in addonsManagerMod");

ACRController = {};

ACRController.addonReports = {};
ACRController.COMPATIBILITY_REPORT_URL_BASE = "https://addons.mozilla.org/en-US/firefox/compatibility/reporter/";

self.port.on("acr_init", function(data) {
    ACRController.exclamationImageURL = data.exclamationImageURL;
});

self.port.on("acr_refresh", function(data) {
    ACRController.onViewChanged();
});

self.port.on("acr_have_addon_report", function(addonReport) {

    /*console.log("[worker] Add-on '" + addonReport.guid + "/" + addonReport.version + "' state: '"
        + addonReport.state + "' compatibility: " + (addonReport.compatible?"IS":"IS NOT")
        + " compatible with this version of the platform.");*/

    ACRController.addonReports[addonReport.guid] = addonReport;
    gViewController.updateCommands();
    
    var ACRUI = ACRController.makeButtonUI(addonReport);

    if (!ACRUI)
        return;

    if (gViewController.currentViewObj._listBox) 
    {
        for (var i=0; i<gViewController.currentViewObj._listBox.itemCount; i++)
        {
            var elem = gViewController.currentViewObj._listBox.getItemAtIndex(i);

            if (elem.getAttribute("value") == addonReport.guid) 
            {
                var controlContainer = document.getAnonymousElementByAttribute(elem, 'anonid', 'control-container');

                if (!controlContainer)
                    return;

                var existingACRUI = controlContainer.getElementsByAttribute("owner", "acr");

                try {
                    if (existingACRUI.length)
                        controlContainer.replaceChild(ACRUI, existingACRUI.item(0));
                    else if (controlContainer.childNodes.length > 0)
                        controlContainer.insertBefore(ACRUI, controlContainer.firstChild);
                    else
                        controlContainer.appendChild(ACRUI);
                } catch (e) {
                    console.log(e.toString());
                }
            }
        }
    }
    else if (gViewController.viewPort.selectedPanel.id == "detail-view")
    {
        var existingACRUI = document.getElementById("detail-view").getElementsByAttribute("owner", "acr");

        if (existingACRUI.length)
            existingACRUI.item(0).parentNode.removeChild(existingACRUI.item(0));

        if (document.getElementById("detail-uninstall"))
            document.getElementById("detail-uninstall").parentNode.insertBefore(ACRUI, document.getElementById("detail-uninstall"));
        else if (document.getElementById("detail-enable-btn"))
            document.getElementById("detail-enable-btn").parentNode.insertBefore(ACRUI, document.getElementById("detail-enable-btn"));
    }
});

ACRController.onViewChanged = function()
{
    //console.log("in view changed: " + gViewController.currentViewId);
    //console.log("addon count: " + document.getElementById("addon-list").itemCount);

    /*
    var existingACRUI = document.getElementsByAttribute("owner", "acr");

    for (var i=0;i<existingACRUI.length;i++)
        existingACRUI.item(i).parentNode.removeChild(existingACRUI.item(i));
    */

    if (gViewController.currentViewObj._listBox) 
    {
        for (var i=0; i<gViewController.currentViewObj._listBox.itemCount; i++)
        {
            var elem = gViewController.currentViewObj._listBox.getItemAtIndex(i);

            if (!elem
                || elem.getAttribute("remote") == "true"
                || elem.getAttribute("plugin") == "true"
                || elem.getAttribute("lwtheme") == "true"
                || elem.getAttribute("type") == "plugin")
                continue;

            self.port.emit("acr_have_addon", elem.getAttribute("value"));
        }
    }
    else if (gDetailView._addon)
    {
        console.log(gDetailView._addon.id);
        self.port.emit("acr_have_addon", gDetailView._addon.id);
    }
}

ACRController.makeButtonUI = function(addonReport)
{
    if (addonReport.state == 2)
    {
        var hbox = document.createElement("hbox");
        hbox.setAttribute("owner", "acr");
        hbox.setAttribute("align", "center");
        var image = document.createElement("image");
        image.setAttribute("width", "16");
        image.setAttribute("height", "16");
        image.setAttribute("src", this.exclamationImageURL);
        hbox.appendChild(image);
        var label = document.createElement("label");
        label.setAttribute("value", "Compatibility Problems"); // TODO l10n
        hbox.appendChild(label);

        return hbox;
    }

    var button = document.createElement("button");
    button.setAttribute("label", "Report Issue"); // TODO l10n
    button.setAttribute("class", "anon-control");
    button.setAttribute("owner", "acr");

    //button.addEventListener("click", function() { ACRController.openSendReportDialog(addonReport); }, true);
    button.addEventListener("click", function()
    {
        //ACRController.openSendReportDialog(addonReport);
        self.port.emit("acr_open_submit_report_dialog", addonReport);
    }, true);

    return button;
}

//Services.obs.addObserver(init, "EM-loaded", false);
document.addEventListener("ViewChanged", ACRController.onViewChanged, true);

gViewController.commands.cmd_showCompatibilityResults = {
    isEnabled: function(aAddon) {
        return aAddon != null && aAddon.type != "plugin" && aAddon.type != "lwtheme";
    },
    doCommand: function(aAddon) {
        openURL(ACRController.COMPATIBILITY_REPORT_URL_BASE + encodeURIComponent(aAddon.id));
    }
};

gViewController.commands.cmd_clearCompatibilityReport = {
    isEnabled: function(aAddon) {   
        if (aAddon == null 
            || aAddon.type == "plugin"
            || aAddon.type == "lwtheme"
            || !ACRController.addonReports[aAddon.id]
            || ACRController.addonReports[aAddon.id].state == 0)
            return false;

        return true;
    },
    doCommand: function(aAddon) {   
        if (aAddon)
            self.port.emit("acr_clear_compatibility_report", aAddon.id);
    }
};

var contextMenu = document.getElementById("addonitem-popup");

var showCompatibilityResults = document.createElement("menuitem");
showCompatibilityResults.setAttribute("command", "cmd_showCompatibilityResults");
showCompatibilityResults.setAttribute("label", "Show Compatibility Results");
contextMenu.appendChild(showCompatibilityResults);

var clearCompatibilityReport = document.createElement("menuitem");
clearCompatibilityReport.setAttribute("command", "cmd_clearCompatibilityReport");
clearCompatibilityReport.setAttribute("label", "Clear Compatibility Report");
contextMenu.appendChild(clearCompatibilityReport);

var commandSet = document.getElementById("viewCommandSet");
var c1 = document.createElement("command");
c1.setAttribute("id", "cmd_showCompatibilityResults");
commandSet.appendChild(c1);

var c2 = document.createElement("command");
c2.setAttribute("id", "cmd_clearCompatibilityReport");
commandSet.appendChild(c2);

