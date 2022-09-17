// ==UserScript==
// @name         TrollTrick
// @version      1.0.0
// @description  Removes ignored users' forum posts instead of collapsing them
// @author       Toni Peric
// @match        https://*.hattrick.org/Forum/*
// @icon         https://i.imgur.com/Mc6R0gO.png
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

const storageKey = 'ignoreList';

function ignore(target)
{
    let ignoreList = getIgnoreList();

    if (! ignoreList.includes(target)) {
        ignoreList.push(target);
        GM_setValue(storageKey, ignoreList);
    }
}

function unignore(target)
{
    let ignoreList = getIgnoreList();

    if (ignoreList.includes(target)) {
        ignoreList.splice(ignoreList.indexOf(target), 1);
        GM_setValue(storageKey, ignoreList);
    }
}

function getIgnoreList()
{
    return GM_getValue(storageKey, Array.from([]));
}

// intercept Hattrick POST requests so that if it's ignore or unignore request, we can react appropriately
(function(open) {
    XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = new URL(url);
        this.addEventListener("readystatechange", function(event) {
            // we only care about completed requests
            if (this.readyState !== XMLHttpRequest.DONE) {
                return;
            }

            // we only care about Hattrick POST requests to /Forum/Functions.aspx
            if (
                ! this._method.toUpperCase() === 'POST' ||
                ! this._url.host.endsWith('hattrick.org') ||
                ! this._url.pathname.startsWith('/Forum/Functions.aspx')
            ) {
                return;
            }

            // we only care about requests that were successful
            if (! (this.status >= 200 && this.status < 300)) {
                return;
            }

            // if it got this far, this is relevant to us
            let action = this._url.searchParams.get('actionTypeFunctions') || false;
            let targetUser = this._url.searchParams.get('u') || false;

            switch (action) {
                case 'ignore':
                    ignore(targetUser);
                    return;

                case 'unignore':
                    unignore(targetUser);
                    return;

                default:
                    console.error('Unsupported action');
                    return;
            }
        }, false);

        open.apply(this, arguments);
    };
})(XMLHttpRequest.prototype.open);

(function() {
    'use strict';

    // if not on forum thread detailview, just do nothing and return early
    if (new URL(document.URL).pathname.startsWith('/Forum/Read.aspx') === false) {
        return;
    }

    // try to detect already ignored users and add them to ignore-list
    document.querySelectorAll('.cfWrapper > div').forEach(function (node) {
        if (node.style.getPropertyValue('display') === 'none') {
            let ignoredUserAnchor = node.querySelector('a[href^="/Club/Manager/"]');

            let ignoredUserId = new URL(ignoredUserAnchor.href).searchParams.get('userId') || false;

            if (! ignoredUserId) {
                console.error(`Couldn't fetch ignored user's ID`);
                return;
            }

            ignore(ignoredUserId);
        }
    });

    // remove all the posts where ignored user is the author, is being replied to or is mentioned within the post itself via a link
    document.querySelectorAll('.cfWrapper').forEach(function (node) {
        node.querySelectorAll('a[href^="/Club/Manager/"]').forEach(function (anchor) {
            let userId = new URL(anchor.href).searchParams.get('userId');

            if (getIgnoreList().includes(userId)) {
                anchor.closest('.cfWrapper').remove();
            }
        });
    });
})();

