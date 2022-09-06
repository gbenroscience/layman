let BODY_ID = 'sys_main';
let GUIDE_CLASS = 'guideline';
let MIN_BIAS = 0.0000000001;

const styleSheet = document.createElement('style');
styleSheet.setAttribute('type', 'text/css');


let page;

let projectURL , scriptURL;
getUrls();
console.log("projectURL: ", projectURL, " , scriptURL: ", scriptURL);
/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/* global PATH_TO_UI_SCRIPTS, xmlKeys, attrKeys, DISABLE_INPUT_SHADOW, PATH_TO_COMPILER_SCRIPTS, ViewController, HTMLCanvasElement, CharacterData, DocumentType, Element, IncludedView, Mustache */
if (!Number.isNaN) {
    Number.isNaN = Number.isNaN || function isNaN(input) {
        return typeof input === 'number' && input !== input;
    };
}

if (!Number.isInteger) {
    Number.isInteger = function (x) {
        // return (x ^ 0) === +x;
        return +x === (+x - (+x % 1));
    };
}

//Polyfill for constructor.name()
(function () {
    if (!Object.constructor.prototype.hasOwnProperty('name')) {
        Object.defineProperty(Object.constructor.prototype, 'name', {
            get: function () {
                return this.toString().trim().replace(/^\S+\s+(\w+)[\S\s]+$/, '$1');
            }
        });
    }
})();
//Polyfill for Node.remove()
(function (arr) {
    arr.forEach(function (item) {
        if (item.hasOwnProperty('remove')) {
            return;
        }
        Object.defineProperty(item, 'remove', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function remove() {
                this.parentNode && this.parentNode.removeChild(this);
            }
        });
    });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype].filter(Boolean));

function isScriptLoaded(scriptURL) {
    let scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        let script = scripts[i];
        if (script.src === scriptURL) {
            return true;
        }
    }
    return null;
}

function docReady(fn) {
    // see if DOM is already available
    if (document.readyState === "complete" || document.readyState === "interactive") {
        fn();
        // call on next available tick
        // setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}


let onLayoutComplete = function () {

};

/**
 *
 * @return {{}}
 */
let layoutCode = function () {
    return null;
};


docReady(function () {
    page = new Page(null);
    page.layout();
    onLayoutComplete();
});

/**
 *
 * @param path The path to the popup's layout
 * @constructor
 */
function RemoteLayoutData(path){
    /**
     * The path to the file that describes the sublayout of the include or popup
     */
    this.path = path;
    /**
     * The DOMRect that describes the parent include(or popup)
     * @type {DOMRect[]}
     */
    this.rect = [];
    /**
     * If true, the
     * @type {boolean}
     */
    this.consumed = false;
}

/**
 *
 * @param {HTMLElement} rootNode May be undefined, or an htmlelement whose html content is to be parsed and laid out
 * @constructor
 */
function Page(rootNode) {
    this.rootElement = rootNode;
    /**
     * A map of ids vs views
     * @type {Map<String, View>}
     */
    this.viewMap = new Map();
    this.hideRoot();
    this.layoutObj = layoutCode();
    this.sourcesLoaded = true;
    /**
     * Store all subpages here by id.
     * @type {Map<String, Page>}
     */
    this.subPages = new Map();
    /**
     * A map of filepaths against the file contents.
     * The keys are the paths, the values are the file contents which define valid html sub-layouts
     * @type {Map<any, any>}
     */
    this.sources = new Map();
    /**
     * Stores all source paths defined in html inline layout code or explicit layout code
     * @type {*[]}
     */
    this.srcPaths = [];

    /**
     *
     * Stores all popup ids against their layout paths here.
     * The key is the id of the popup definition,
     * The value is the src(filepath) to the html markup of the popup's  content.
     * The library reads out the popups, stores them here and removes every trace of the popups from the original page code.
     * @type {Map<String, RemoteLayoutData>}
     */
    this.popups = new Map();


    /**
     *
     * Stores all included element ids against their layout path metadata here.
     * The key is the id of the included div definition,
     * The value is the src(filepath) to the html markup of the include's  content.
     * The library lays out the includes with the main page and renders their content in their blank area as the layouts arrive via fetch
     * @type {Map<String, RemoteLayoutData>}
     */
    this.includes = new Map();

    if (!rootNode) {
        let htmlBodyStyle = new Style('html,body', []);
        htmlBodyStyle.addFromOptions({
            width: '100%',
            height: '100%',
            padding: '0',
            margin: '0'
        });

        let generalStyle = new Style("*", []);
        generalStyle.addFromOptions({
            'margin': '0',
            'padding': '0',
            'box-sizing': 'border-box',
            '-webkit-box-sizing': 'border-box',
            '-moz-box-sizing': 'border-box',
            'overscroll-behavior': 'none'
        });
        let styleObj = new Style('.abs', []);
        styleObj.addStyleElement('position', 'absolute');
        styleObj.addStyleElement('padding', '0');
        styleObj.addStyleElement('margin', '0');

        updateOrCreateSelectorInStyleSheet(styleSheet, htmlBodyStyle);
        updateOrCreateSelectorInStyleSheet(styleSheet, generalStyle);
        updateOrCreateSelectorInStyleSheet(styleSheet, styleObj)

        let color = document.body.getAttribute(attrKeys.layout_constraintGuideColor);
        if (!color) {
            if (this.layoutObj) {
                if (this.layoutObj.body) {
                    color = this.layoutObj.body['data-guide-color'];
                }
            }
        }
        let style = new Style('.' + GUIDE_CLASS, []);
        style.addFromOptions({
            'background-color': (!color ? 'transparent' : color),
            'visibility': (!color ? 'hidden' : 'visible')
        });

        updateOrCreateSelectorInStyleSheet(styleSheet, style);
    }

}

Page.prototype.findViewById = function (viewId) {
    return this.viewMap.get(viewId);
};

/**
 * checks if the node is one of the nodes that should be ignored
 * @param node
 * @return {boolean}
 */
function shouldIgnoreNode(node) {
    let name = node.nodeName.toLowerCase();
    return (name === 'li' || name === 'tr' || name === 'td' || name === 'th' || name === 'tbody' || name === 'thead'
        || name === 'tfoot' || name === 'col' || name === 'colgroup' || name === '#text' || name === '#comment'
        || name === 'script' || name === 'option' || name === 'optgroup'
        || name === 'b' || name === 'i' || name === 'strong' || name === 'u'
    );
}

/**
 * Checks if the node is a comment, a whitespace or a script node
 * @param node
 * @return {boolean}
 */
function isWhiteSpaceOrCommentNode(node) {
    let name = node.nodeName.toLowerCase();
    return (name === '#text' || name === '#comment');
}

/**
 * Checks if the node is a comment, a whitespace or a script node
 * @param node
 * @return {boolean}
 */
function isWhiteSpaceCommentOrScriptNode(node) {
    let name = node.nodeName.toLowerCase();
    return (name === '#text' || name === '#comment' || name === 'script');
}

/**
 * Checks if the node is one of the ui nodes that are children of other nodes and that need to be ignored when doing layout.
 * E.g. li, td, th, tbody, thead, tfoot, col and colgroup are all laid out by their parents.
 * @param node
 * @return {boolean}
 */
function shouldIgnoreSpecialChildElement(node) {
    let name = node.nodeName.toLowerCase();
    return (name === 'li' || name === 'tr' || name === 'td' || name === 'th' || name === 'tbody' || name === 'thead'
        || name === 'tfoot' || name === 'col' || name === 'colgroup' || name === 'option' || name === 'optgroup'
        || name === 'b' || name === 'i' || name === 'strong' || name === 'u');
}

/**
 * This layout system needs every view to have an id.
 * We cant force developers to assign ids to things like li or td, th etc.
 * Though we can enforce them to apply ids to their parents.
 * So we auto-assign ids to the child elements if there are no ids on them
 */
function enforceIdOnChildElements(node) {
    if (shouldIgnoreSpecialChildElement(node)) {
        let id = node.getAttribute(attrKeys.id);
        if (!id) {
            node.setAttribute(attrKeys.id, ULID.ulid());
        }
    }
}

Page.prototype.layout = function () {
    if(this === page) {
        let layoutObj = layoutCode();
        if (layoutObj) {
            this.layoutFromSheet(this.rootElement);
        } else {
            this.layoutFromTags(this.rootElement);
        }
    }else{
        this.layoutFromTags(this.rootElement);
    }
};
/**
 *
 * @param {HTMLElement} node
 */
Page.prototype.layoutFromSheet = function (node) {

    let disPage = this;
    let root = !node ? document.body : node;
    if (root === document.body) {
        root.id = BODY_ID;
    }

    if (node) {
        let name = node.nodeName.toLowerCase();
        if (name === 'script') {
            return;
        }
        if (!node.id) {
            if (!shouldIgnoreSpecialChildElement(node)) {
                throw 'Please supply the id for node: ' + name + ', around:\n' + node.outerHTML + ". The layout engine needs it.";
            }
        }
    }

    if (!isWhiteSpaceOrCommentNode(root)) {
        let constraints = root === document.body ? this.layoutObj.body : (this.layoutObj.elements[root.id]);

        if (constraints) {
            if (root === document.body) {
                constraints['w'] = 'match_parent';
                constraints['h'] = 'match_parent';
                constraints['ss'] = 'parent';
                constraints['ee'] = 'parent';
                constraints['tt'] = 'parent';
                constraints['bb'] = 'parent';
            }
        } else {
            if (root === document.body) {
                constraints = {
                    'w': 'match_parent', 'h': 'match_parent', 'ss': 'parent',
                    'ee': 'parent', 'tt': 'parent', 'bb': 'parent'
                };
            } else {
                constraints = {
                    'w': 'match_parent', 'h': 'match_parent', 'ss': 'parent',
                    'ee': 'parent', 'tt': 'parent', 'bb': 'parent'
                };
            }
        }

        let refIds = new Map();
        Object.keys(constraints).forEach(function (key) {
            let val = constraints[key];
            refIds.set(key, val);
            if (key === attrKeys.layout_src) {
                let isPopup = constraints[attrKeys.layout_popup]
                disPage.srcPaths.push(val);
                disPage.sourcesLoaded = false;
                let popupData = new RemoteLayoutData(val);
                if(isPopup === true){
                    disPage.popups.set(root.id, popupData);
                }else{
                    disPage.includes.set(root.id, popupData);
                }
            }
        });
        let view;

        let attr = constraints[attrKeys.layout_constraintGuide];
        if (!attr) {
            enforceIdOnChildElements(root);
            if (root === document.body) {
                view = new View(this, root, refIds, undefined);
            } else {
                view = new View(this, root, refIds, root.parentNode.id);
            }
        } else {
            if (attr === 'true' || attr === true) {
                //The next 2 lines forces the Guidelines size to be determined by our code. Take control from the user.
                refIds.set(attrKeys.layout_width, sizes.WRAP_CONTENT);
                refIds.set(attrKeys.layout_height, sizes.WRAP_CONTENT);
                view = new Guideline(this, root, refIds, root.parentNode.id);
            } else {
                throw 'Invalid value for guide';
            }

        }

        if (root.hasChildNodes()) {
            let childNodes = root.children;
            for (let j = 0; j < childNodes.length; j++) {
                let childNode = childNodes[j];
                if (!isWhiteSpaceCommentOrScriptNode(childNode)) {
                    if (!shouldIgnoreSpecialChildElement(childNode)) {
                        let childId = childNode.getAttribute(attrKeys.id);
                        view.childrenIds.push(childId);//register the child with the parent
                    }
                    this.layoutFromSheet(childNode);
                }
            }//end for loop
        }
        if (view) {
            if (view.topLevel === true) {
                this.buildUI(view);
                this.showRoot();
                if(disPage.srcPaths.length > 0){
                    var worker = BuildBridgedWorker(workerCode, ["loadAll"], ["layoutLoaded", "layoutError"], [layoutLoaded, layoutError]);
                    worker.loadAll(projectURL, disPage.srcPaths);
                }else{
                    disPage.sourcesLoaded = true;
                }

            }
        }
    }
};

/**
 *
 * @param {HTMLElement} node
 */
Page.prototype.layoutFromTags = function (node) {

    let disPage = this;
    let root = !node ? document.body : node;
    if (root === document.body) {
        root.id = BODY_ID;
    }
    if (node) {
        let name = node.nodeName.toLowerCase();
        if (name === 'script') {
            return;
        }
        if (!node.id) {
            if (!shouldIgnoreSpecialChildElement(node)) {
                throw 'Please supply the id for node: ' + name + ', around:\n' + node.outerHTML + ". The layout engine needs it.";
            }
        }
    }

    if (!isWhiteSpaceOrCommentNode(root)) {
        let constraints = root.getAttribute(attrKeys.layout_constraint);
        root.removeAttribute(attrKeys.layout_constraint);
        if (!constraints) {
            if (root === document.body) {
                constraints = 'w:match_parent;h:match_parent;ss:parent;ee:parent;tt:parent;bb:parent'
            } else {
                constraints = 'w:match_parent;h:match_parent;ss:parent;ee:parent;tt:parent;bb:parent'
            }
        }
        constraints = constraints.trim();
        if (endsWith(constraints, ";")) {
            constraints = constraints.substring(0, constraints.length - 1);
        }
        constraints = constraints.replace(/\s/g, "");
        constraints = constraints.split(";");

        let refIds = new Map();
        let isPopup;
        let src = null;
        for (let i = 0; i < constraints.length; i++) {
            let con = constraints[i];
            let indexColon;
            if ((indexColon = con.indexOf(":")) !== -1) {
                let attr = con.substring(0, indexColon);
                let val = con.substring(indexColon + 1);
                refIds.set(attr, val);
                if (attr === attrKeys.layout_src) {
                    disPage.srcPaths.push(val);
                    disPage.sourcesLoaded = false;
                    src = val;
                }
                if(attr === attrKeys.layout_popup){
                    isPopup = true;
                }
            } else {
                throw 'invalid constraint definition... no colon found in ' + con + " on " + root.id;
            }
        }
       if(src){
           let popupData = new RemoteLayoutData(src);
           if(isPopup === true){
               disPage.popups.set(root.id, popupData);
           }else{
               disPage.includes.set(root.id, popupData);
           }
       }

        let view;

        let attr = root.getAttribute(attrKeys.layout_constraintGuide);
        if (!attr) {
            enforceIdOnChildElements(root);
            if (root === document.body) {
                view = new View(this, root, refIds, undefined);
            } else {
                view = new View(this, root, refIds, root.parentNode.id);
            }
        } else {
            if (attr === 'true') {
                //The next 2 lines forces the Guidelines size to be determined by our code. Take control from the user.
                refIds.set(attrKeys.layout_width, sizes.WRAP_CONTENT);
                refIds.set(attrKeys.layout_height, sizes.WRAP_CONTENT);
                view = new Guideline(this, root, refIds, root.parentNode.id);
            } else {
                throw 'Invalid value for data-guide';
            }
        }

        if (root.hasChildNodes()) {
            let childNodes = root.children;
            for (let j = 0; j < childNodes.length; j++) {
                let childNode = childNodes[j];
                if (!isWhiteSpaceCommentOrScriptNode(childNode)) {
                    if (!shouldIgnoreSpecialChildElement(childNode)) {
                        let childId = childNode.getAttribute(attrKeys.id);
                        view.childrenIds.push(childId);//register the child with the parent
                    }
                    this.layoutFromTags(childNode);
                }
            }//end for loop
        }

        if (view) {
            if (view.topLevel === true) {
                this.buildUI(view);
                this.showRoot();
                if(disPage.srcPaths.length > 0){
                    var worker = BuildBridgedWorker(workerCode, ["loadAll"], ["layoutLoaded", "layoutError"], [layoutLoaded, layoutError]);
                    worker.loadAll(projectURL, disPage.srcPaths);
                }else{
                    disPage.sourcesLoaded = true;
                }
            }
        }
    }

};


Page.prototype.buildUI = function (rootView) {
    let pops = [];
    let layAll = function (v, page) {
        if (v.childrenIds.length > 0) {
            autoLayout(v.htmlNode === document.body ? undefined : v.htmlNode, v.layoutChildren(page));
            v.childrenIds.forEach(function (id) {
                let cv = page.viewMap.get(id);
                if(cv.isPopup()){
                    pops.push(cv);
                }
                if (cv.childrenIds.length > 0) {
                    layAll(cv, page);
                }
            });
        }
    };
    layAll(rootView, this);
    let currentPage = this;
    pops.forEach(function (popup) {
        let ppData = currentPage.popups.get(popup.id);
        ppData.rect = popup.htmlNode.getBoundingClientRect();
        currentPage.popups.set(popup.id, ppData);
        popup.htmlNode.remove();
    });
};

Page.prototype.showRoot = function () {
    if (!this.rootElement || this.rootElement === document.body) {
        document.body.style.visibility = 'visible';
    } else {
        this.rootElement.style.visibility = 'visible';
    }
};
Page.prototype.hideRoot = function () {
    if (!this.rootElement || this.rootElement === document.body) {
        document.body.style.visibility = 'hidden';
    } else {
        this.rootElement.style.visibility = 'hidden';
    }
};

/**
 *
 * @param popupId The id of the popup.
 * @param closeOnClickOutSide If true, will close the popup if the user clicks outside its layout(on the overlay).
 * @return {Popup}
 */
Page.prototype.openPopup = function(popupId, closeOnClickOutSide){
    let pg = this;
    let ppData = this.popups.get(popupId);

    let html = this.sources.get(ppData.path);
    let r = ppData.rect;
    if(!r || !r.width || !r.height){
        throw 'specify width or height on popup: '+popupId;
    }
    let popup = new Popup({
        id: popupId,
        layout: html,
        width: r.width,
        height: r.height,
        closeOnClickOutside: typeof closeOnClickOutSide === "boolean" ? closeOnClickOutSide : false,
        bg: "#fff"
    });
    return popup.open();
};

/**
 * Close a popup
 * @param popup The popup.
 */
Page.prototype.closePopup = function(popup){
    popup.hide();
};

/**
 *
 * Render the included html in its include
 * @param includeID The id of the layout that the included html will be attached to
 * @param htmlContent The html sublayout
 */
Page.prototype.renderInclude = function(includeID,htmlContent){
    let layoutData = this.includes.get(includeID);
    let path = layoutData.path;
    let html = !htmlContent ? this.sources.get(path) : htmlContent;
    let elem = document.getElementById(includeID);
    elem.innerHTML = htmlContent;
    let pg = new Page(elem);
    pg.layout();
    this.subPages.set(includeID, pg);
};

var workerCode = function () {

    function loadAll(basePath,files) {
        loadFiles(basePath, files, 0);
    }

    function loadFiles(basePath, files, i) {
        if (Array.isArray(files)) {
            if (i < files.length) {
                var path = files[i];
                loadFile(basePath, path, function (html) {
                    main.layoutLoaded(path, html, false);
                    loadFiles(basePath, files, i + 1);
                });
            } else {
                main.layoutLoaded(null, '', true);
            }
        } else {
            main.layoutError(new Error('Pass an array of filepaths here'));
        }
    }

    function loadFile(basePath, layoutFile, callback) {

        const absolute = new URL( layoutFile, basePath )
        fetch(absolute, {
            credentials: 'same-origin'
        }).then(function (response) {
            return response;
        }).then(function (data) {
            return data.text();
        }).then(function (xmlLayout) {
            callback(xmlLayout);
        }).catch(function (err) {
            setTimeout(function () {
                main.layoutError(err);
                throw err;
            });
        });
    }

//////////////////////////Promise-polyfill/////////////////////////////
    !function (e, t) {
        "object" == typeof exports && "undefined" != typeof module ? t() : "function" == typeof define && define.amd ? define(t) : t()
    }(0, function () {
        "use strict";

        function e(e) {
            var t = this.constructor;
            return this.then(function (n) {
                return t.resolve(e()).then(function () {
                    return n
                })
            }, function (n) {
                return t.resolve(e()).then(function () {
                    return t.reject(n)
                })
            })
        }

        function t(e) {
            return new this(function (t, n) {
                function o(e, n) {
                    if (n && ("object" == typeof n || "function" == typeof n)) {
                        var f = n.then;
                        if ("function" == typeof f) return void f.call(n, function (t) {
                            o(e, t)
                        }, function (n) {
                            r[e] = {status: "rejected", reason: n}, 0 == --i && t(r)
                        })
                    }
                    r[e] = {status: "fulfilled", value: n}, 0 == --i && t(r)
                }

                if (!e || "undefined" == typeof e.length) return n(new TypeError(typeof e + " " + e + " is not iterable(cannot read property Symbol(Symbol.iterator))"));
                var r = Array.prototype.slice.call(e);
                if (0 === r.length) return t([]);
                for (var i = r.length, f = 0; r.length > f; f++) o(f, r[f])
            })
        }

        function n(e) {
            return !(!e || "undefined" == typeof e.length)
        }

        function o() {
        }

        function r(e) {
            if (!(this instanceof r)) throw new TypeError("Promises must be constructed via new");
            if ("function" != typeof e) throw new TypeError("not a function");
            this._state = 0, this._handled = !1, this._value = undefined, this._deferreds = [], l(e, this)
        }

        function i(e, t) {
            for (; 3 === e._state;) e = e._value;
            0 !== e._state ? (e._handled = !0, r._immediateFn(function () {
                var n = 1 === e._state ? t.onFulfilled : t.onRejected;
                if (null !== n) {
                    var o;
                    try {
                        o = n(e._value)
                    } catch (r) {
                        return void u(t.promise, r)
                    }
                    f(t.promise, o)
                } else (1 === e._state ? f : u)(t.promise, e._value)
            })) : e._deferreds.push(t)
        }

        function f(e, t) {
            try {
                if (t === e) throw new TypeError("A promise cannot be resolved with itself.");
                if (t && ("object" == typeof t || "function" == typeof t)) {
                    var n = t.then;
                    if (t instanceof r) return e._state = 3, e._value = t, void c(e);
                    if ("function" == typeof n) return void l(function (e, t) {
                        return function () {
                            e.apply(t, arguments)
                        }
                    }(n, t), e)
                }
                e._state = 1, e._value = t, c(e)
            } catch (o) {
                u(e, o)
            }
        }

        function u(e, t) {
            e._state = 2, e._value = t, c(e)
        }

        function c(e) {
            2 === e._state && 0 === e._deferreds.length && r._immediateFn(function () {
                e._handled || r._unhandledRejectionFn(e._value)
            });
            for (var t = 0, n = e._deferreds.length; n > t; t++) i(e, e._deferreds[t]);
            e._deferreds = null
        }

        function l(e, t) {
            var n = !1;
            try {
                e(function (e) {
                    n || (n = !0, f(t, e))
                }, function (e) {
                    n || (n = !0, u(t, e))
                })
            } catch (o) {
                if (n) return;
                n = !0, u(t, o)
            }
        }

        var a = setTimeout;
        r.prototype["catch"] = function (e) {
            return this.then(null, e)
        }, r.prototype.then = function (e, t) {
            var n = new this.constructor(o);
            return i(this, new function (e, t, n) {
                this.onFulfilled = "function" == typeof e ? e : null, this.onRejected = "function" == typeof t ? t : null, this.promise = n
            }(e, t, n)), n
        }, r.prototype["finally"] = e, r.all = function (e) {
            return new r(function (t, o) {
                function r(e, n) {
                    try {
                        if (n && ("object" == typeof n || "function" == typeof n)) {
                            var u = n.then;
                            if ("function" == typeof u) return void u.call(n, function (t) {
                                r(e, t)
                            }, o)
                        }
                        i[e] = n, 0 == --f && t(i)
                    } catch (c) {
                        o(c)
                    }
                }

                if (!n(e)) return o(new TypeError("Promise.all accepts an array"));
                var i = Array.prototype.slice.call(e);
                if (0 === i.length) return t([]);
                for (var f = i.length, u = 0; i.length > u; u++) r(u, i[u])
            })
        }, r.allSettled = t, r.resolve = function (e) {
            return e && "object" == typeof e && e.constructor === r ? e : new r(function (t) {
                t(e)
            })
        }, r.reject = function (e) {
            return new r(function (t, n) {
                n(e)
            })
        }, r.race = function (e) {
            return new r(function (t, o) {
                if (!n(e)) return o(new TypeError("Promise.race accepts an array"));
                for (var i = 0, f = e.length; f > i; i++) r.resolve(e[i]).then(t, o)
            })
        }, r._immediateFn = "function" == typeof setImmediate && function (e) {
            setImmediate(e)
        } || function (e) {
            a(e, 0)
        }, r._unhandledRejectionFn = function (e) {
            void 0 !== console && console && console.warn("Possible Unhandled Promise Rejection:", e)
        };
        var s = function () {
            if ("undefined" != typeof self) return self;
            if ("undefined" != typeof window) return window;
            if ("undefined" != typeof global) return global;
            throw Error("unable to locate global object")
        }();
        "function" != typeof s.Promise ? s.Promise = r : (s.Promise.prototype["finally"] || (s.Promise.prototype["finally"] = e), s.Promise.allSettled || (s.Promise.allSettled = t))
    });

//////////////////////////Promise-polyfill-ends/////////////////////////////


//////////////////////////fetch-polyfill////////////////////////////////////
    (function (global, factory) {
        typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
            typeof define === 'function' && define.amd ? define(['exports'], factory) :
                (factory((global.WHATWGFetch = {})));
    }(this, (function (exports) {
        'use strict';

        var global = (typeof self !== 'undefined' && self) || (typeof global !== 'undefined' && global);

        var support = {
            searchParams: 'URLSearchParams' in global,
            iterable: 'Symbol' in global && 'iterator' in Symbol,
            blob:
                'FileReader' in global &&
                'Blob' in global &&
                (function () {
                    try {
                        new Blob();
                        return true
                    } catch (e) {
                        return false
                    }
                })(),
            formData: 'FormData' in global,
            arrayBuffer: 'ArrayBuffer' in global
        };

        function isDataView(obj) {
            return obj && DataView.prototype.isPrototypeOf(obj)
        }

        if (support.arrayBuffer) {
            var viewClasses = [
                '[object Int8Array]',
                '[object Uint8Array]',
                '[object Uint8ClampedArray]',
                '[object Int16Array]',
                '[object Uint16Array]',
                '[object Int32Array]',
                '[object Uint32Array]',
                '[object Float32Array]',
                '[object Float64Array]'
            ];

            var isArrayBufferView =
                ArrayBuffer.isView ||
                function (obj) {
                    return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
                };
        }

        function normalizeName(name) {
            if (typeof name !== 'string') {
                name = String(name);
            }
            if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
                throw new TypeError('Invalid character in header field name')
            }
            return name.toLowerCase()
        }

        function normalizeValue(value) {
            if (typeof value !== 'string') {
                value = String(value);
            }
            return value
        }

        // Build a destructive iterator for the value list
        function iteratorFor(items) {
            var iterator = {
                next: function () {
                    var value = items.shift();
                    return {done: value === undefined, value: value}
                }
            };

            if (support.iterable) {
                iterator[Symbol.iterator] = function () {
                    return iterator
                };
            }

            return iterator
        }

        function Headers(headers) {
            this.map = {};

            if (headers instanceof Headers) {
                headers.forEach(function (value, name) {
                    this.append(name, value);
                }, this);
            } else if (Array.isArray(headers)) {
                headers.forEach(function (header) {
                    this.append(header[0], header[1]);
                }, this);
            } else if (headers) {
                Object.getOwnPropertyNames(headers).forEach(function (name) {
                    this.append(name, headers[name]);
                }, this);
            }
        }

        Headers.prototype.append = function (name, value) {
            name = normalizeName(name);
            value = normalizeValue(value);
            var oldValue = this.map[name];
            this.map[name] = oldValue ? oldValue + ', ' + value : value;
        };

        Headers.prototype['delete'] = function (name) {
            delete this.map[normalizeName(name)];
        };

        Headers.prototype.get = function (name) {
            name = normalizeName(name);
            return this.has(name) ? this.map[name] : null
        };

        Headers.prototype.has = function (name) {
            return this.map.hasOwnProperty(normalizeName(name))
        };

        Headers.prototype.set = function (name, value) {
            this.map[normalizeName(name)] = normalizeValue(value);
        };

        Headers.prototype.forEach = function (callback, thisArg) {
            for (var name in this.map) {
                if (this.map.hasOwnProperty(name)) {
                    callback.call(thisArg, this.map[name], name, this);
                }
            }
        };

        Headers.prototype.keys = function () {
            var items = [];
            this.forEach(function (value, name) {
                items.push(name);
            });
            return iteratorFor(items)
        };

        Headers.prototype.values = function () {
            var items = [];
            this.forEach(function (value) {
                items.push(value);
            });
            return iteratorFor(items)
        };

        Headers.prototype.entries = function () {
            var items = [];
            this.forEach(function (value, name) {
                items.push([name, value]);
            });
            return iteratorFor(items)
        };

        if (support.iterable) {
            Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
        }

        function consumed(body) {
            if (body.bodyUsed) {
                return Promise.reject(new TypeError('Already read'))
            }
            body.bodyUsed = true;
        }

        function fileReaderReady(reader) {
            return new Promise(function (resolve, reject) {
                reader.onload = function () {
                    resolve(reader.result);
                };
                reader.onerror = function () {
                    reject(reader.error);
                };
            })
        }

        function readBlobAsArrayBuffer(blob) {
            var reader = new FileReader();
            var promise = fileReaderReady(reader);
            reader.readAsArrayBuffer(blob);
            return promise
        }

        function readBlobAsText(blob) {
            var reader = new FileReader();
            var promise = fileReaderReady(reader);
            reader.readAsText(blob);
            return promise
        }

        function readArrayBufferAsText(buf) {
            var view = new Uint8Array(buf);
            var chars = new Array(view.length);

            for (var i = 0; i < view.length; i++) {
                chars[i] = String.fromCharCode(view[i]);
            }
            return chars.join('')
        }

        function bufferClone(buf) {
            if (buf.slice) {
                return buf.slice(0)
            } else {
                var view = new Uint8Array(buf.byteLength);
                view.set(new Uint8Array(buf));
                return view.buffer
            }
        }

        function Body() {
            this.bodyUsed = false;

            this._initBody = function (body) {
                /*
                  fetch-mock wraps the Response object in an ES6 Proxy to
                  provide useful test harness features such as flush. However, on
                  ES5 browsers without fetch or Proxy support pollyfills must be used;
                  the proxy-pollyfill is unable to proxy an attribute unless it exists
                  on the object before the Proxy is created. This change ensures
                  Response.bodyUsed exists on the instance, while maintaining the
                  semantic of setting Request.bodyUsed in the constructor before
                  _initBody is called.
                */
                this.bodyUsed = this.bodyUsed;
                this._bodyInit = body;
                if (!body) {
                    this._bodyText = '';
                } else if (typeof body === 'string') {
                    this._bodyText = body;
                } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
                    this._bodyBlob = body;
                } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
                    this._bodyFormData = body;
                } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                    this._bodyText = body.toString();
                } else if (support.arrayBuffer && support.blob && isDataView(body)) {
                    this._bodyArrayBuffer = bufferClone(body.buffer);
                    // IE 10-11 can't handle a DataView body.
                    this._bodyInit = new Blob([this._bodyArrayBuffer]);
                } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
                    this._bodyArrayBuffer = bufferClone(body);
                } else {
                    this._bodyText = body = Object.prototype.toString.call(body);
                }

                if (!this.headers.get('content-type')) {
                    if (typeof body === 'string') {
                        this.headers.set('content-type', 'text/plain;charset=UTF-8');
                    } else if (this._bodyBlob && this._bodyBlob.type) {
                        this.headers.set('content-type', this._bodyBlob.type);
                    } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                        this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
                    }
                }
            };

            if (support.blob) {
                this.blob = function () {
                    var rejected = consumed(this);
                    if (rejected) {
                        return rejected
                    }

                    if (this._bodyBlob) {
                        return Promise.resolve(this._bodyBlob)
                    } else if (this._bodyArrayBuffer) {
                        return Promise.resolve(new Blob([this._bodyArrayBuffer]))
                    } else if (this._bodyFormData) {
                        throw new Error('could not read FormData body as blob')
                    } else {
                        return Promise.resolve(new Blob([this._bodyText]))
                    }
                };

                this.arrayBuffer = function () {
                    if (this._bodyArrayBuffer) {
                        var isConsumed = consumed(this);
                        if (isConsumed) {
                            return isConsumed
                        }
                        if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                            return Promise.resolve(
                                this._bodyArrayBuffer.buffer.slice(
                                    this._bodyArrayBuffer.byteOffset,
                                    this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                                )
                            )
                        } else {
                            return Promise.resolve(this._bodyArrayBuffer)
                        }
                    } else {
                        return this.blob().then(readBlobAsArrayBuffer)
                    }
                };
            }

            this.text = function () {
                var rejected = consumed(this);
                if (rejected) {
                    return rejected
                }

                if (this._bodyBlob) {
                    return readBlobAsText(this._bodyBlob)
                } else if (this._bodyArrayBuffer) {
                    return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
                } else if (this._bodyFormData) {
                    throw new Error('could not read FormData body as text')
                } else {
                    return Promise.resolve(this._bodyText)
                }
            };

            if (support.formData) {
                this.formData = function () {
                    return this.text().then(decode)
                };
            }

            this.json = function () {
                return this.text().then(JSON.parse)
            };

            return this
        }

        // HTTP methods whose capitalization should be normalized
        var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

        function normalizeMethod(method) {
            var upcased = method.toUpperCase();
            return methods.indexOf(upcased) > -1 ? upcased : method
        }

        function Request(input, options) {
            if (!(this instanceof Request)) {
                throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
            }

            options = options || {};
            var body = options.body;

            if (input instanceof Request) {
                if (input.bodyUsed) {
                    throw new TypeError('Already read')
                }
                this.url = input.url;
                this.credentials = input.credentials;
                if (!options.headers) {
                    this.headers = new Headers(input.headers);
                }
                this.method = input.method;
                this.mode = input.mode;
                this.signal = input.signal;
                if (!body && input._bodyInit != null) {
                    body = input._bodyInit;
                    input.bodyUsed = true;
                }
            } else {
                this.url = String(input);
            }

            this.credentials = options.credentials || this.credentials || 'same-origin';
            if (options.headers || !this.headers) {
                this.headers = new Headers(options.headers);
            }
            this.method = normalizeMethod(options.method || this.method || 'GET');
            this.mode = options.mode || this.mode || null;
            this.signal = options.signal || this.signal;
            this.referrer = null;

            if ((this.method === 'GET' || this.method === 'HEAD') && body) {
                throw new TypeError('Body not allowed for GET or HEAD requests')
            }
            this._initBody(body);

            if (this.method === 'GET' || this.method === 'HEAD') {
                if (options.cache === 'no-store' || options.cache === 'no-cache') {
                    // Search for a '_' parameter in the query string
                    var reParamSearch = /([?&])_=[^&]*/;
                    if (reParamSearch.test(this.url)) {
                        // If it already exists then set the value with the current time
                        this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
                    } else {
                        // Otherwise add a new '_' parameter to the end with the current time
                        var reQueryString = /\?/;
                        this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
                    }
                }
            }
        }

        Request.prototype.clone = function () {
            return new Request(this, {body: this._bodyInit})
        };

        function decode(body) {
            var form = new FormData();
            body
                .trim()
                .split('&')
                .forEach(function (bytes) {
                    if (bytes) {
                        var split = bytes.split('=');
                        var name = split.shift().replace(/\+/g, ' ');
                        var value = split.join('=').replace(/\+/g, ' ');
                        form.append(decodeURIComponent(name), decodeURIComponent(value));
                    }
                });
            return form
        }

        function parseHeaders(rawHeaders) {
            var headers = new Headers();
            // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
            // https://tools.ietf.org/html/rfc7230#section-3.2
            var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
            preProcessedHeaders.split(/\r?\n/).forEach(function (line) {
                var parts = line.split(':');
                var key = parts.shift().trim();
                if (key) {
                    var value = parts.join(':').trim();
                    headers.append(key, value);
                }
            });
            return headers
        }

        Body.call(Request.prototype);

        function Response(bodyInit, options) {
            if (!(this instanceof Response)) {
                throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
            }
            if (!options) {
                options = {};
            }

            this.type = 'default';
            this.status = options.status === undefined ? 200 : options.status;
            this.ok = this.status >= 200 && this.status < 300;
            this.statusText = 'statusText' in options ? options.statusText : '';
            this.headers = new Headers(options.headers);
            this.url = options.url || '';
            this._initBody(bodyInit);
        }

        Body.call(Response.prototype);

        Response.prototype.clone = function () {
            return new Response(this._bodyInit, {
                status: this.status,
                statusText: this.statusText,
                headers: new Headers(this.headers),
                url: this.url
            })
        };

        Response.error = function () {
            var response = new Response(null, {status: 0, statusText: ''});
            response.type = 'error';
            return response
        };

        var redirectStatuses = [301, 302, 303, 307, 308];

        Response.redirect = function (url, status) {
            if (redirectStatuses.indexOf(status) === -1) {
                throw new RangeError('Invalid status code')
            }

            return new Response(null, {status: status, headers: {location: url}})
        };

        exports.DOMException = global.DOMException;
        try {
            new exports.DOMException();
        } catch (err) {
            exports.DOMException = function (message, name) {
                this.message = message;
                this.name = name;
                var error = Error(message);
                this.stack = error.stack;
            };
            exports.DOMException.prototype = Object.create(Error.prototype);
            exports.DOMException.prototype.constructor = exports.DOMException;
        }

        function fetch(input, init) {
            return new Promise(function (resolve, reject) {
                var request = new Request(input, init);

                if (request.signal && request.signal.aborted) {
                    return reject(new exports.DOMException('Aborted', 'AbortError'))
                }

                var xhr = new XMLHttpRequest();

                function abortXhr() {
                    xhr.abort();
                }

                xhr.onload = function () {
                    var options = {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
                    };
                    options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
                    var body = 'response' in xhr ? xhr.response : xhr.responseText;
                    setTimeout(function () {
                        resolve(new Response(body, options));
                    }, 0);
                };

                xhr.onerror = function () {
                    setTimeout(function () {
                        reject(new TypeError('Network request failed'));
                    }, 0);
                };

                xhr.ontimeout = function () {
                    setTimeout(function () {
                        reject(new TypeError('Network request failed'));
                    }, 0);
                };

                xhr.onabort = function () {
                    setTimeout(function () {
                        reject(new exports.DOMException('Aborted', 'AbortError'));
                    }, 0);
                };

                function fixUrl(url) {
                    try {
                        return url === '' && global.location.href ? global.location.href : url
                    } catch (e) {
                        return url
                    }
                }

                xhr.open(request.method, fixUrl(request.url), true);

                if (request.credentials === 'include') {
                    xhr.withCredentials = true;
                } else if (request.credentials === 'omit') {
                    xhr.withCredentials = false;
                }

                if ('responseType' in xhr) {
                    if (support.blob) {
                        xhr.responseType = 'blob';
                    } else if (
                        support.arrayBuffer &&
                        request.headers.get('Content-Type') &&
                        request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
                    ) {
                        xhr.responseType = 'arraybuffer';
                    }
                }

                if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
                    Object.getOwnPropertyNames(init.headers).forEach(function (name) {
                        xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
                    });
                } else {
                    request.headers.forEach(function (value, name) {
                        xhr.setRequestHeader(name, value);
                    });
                }

                if (request.signal) {
                    request.signal.addEventListener('abort', abortXhr);

                    xhr.onreadystatechange = function () {
                        // DONE (success or failure)
                        if (xhr.readyState === 4) {
                            request.signal.removeEventListener('abort', abortXhr);
                        }
                    };
                }

                xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
            })
        }

        fetch.polyfill = true;

        if (!global.fetch) {
            global.fetch = fetch;
            global.Headers = Headers;
            global.Request = Request;
            global.Response = Response;
        }

        exports.Headers = Headers;
        exports.Request = Request;
        exports.Response = Response;
        exports.fetch = fetch;

        Object.defineProperty(exports, '__esModule', {value: true});

    })));

//////////////////////////fetch-polyfill-ends////////////////////////////////////
};

var layoutLoaded = function (filePath, htmlContent, allLoaded) {
  //  console.log('layoutLoaded:--> ', 'filepath: ', filePath, ", layout: ", htmlContent, ", allLoaded: ", allLoaded);
    page.sources.set(filePath, htmlContent);
    page.includes.forEach(function(layoutData, id){
        if(layoutData.consumed === false){
            if(layoutData.path === filePath){
                page.renderInclude(id, htmlContent);
                layoutData.consumed = true;
            }
        }
    });
    page.sourcesLoaded = allLoaded;
};

var layoutError = function (error) {
    throw error;
};

/**
 * Generates constraints needed to layout the root element of any layout on the physical DOM
 * element on which it is to be bound.
 * @param {string} bindingElemId The id of the physical DOM element to which the xml layout will be attached
 * @param {string} rootChildID The id of the root element of the xml layout
 * @returns an array of raw constraints to use in the layout
 */
function layoutRootOnBindingElement(bindingElemId, rootChildID) {
    if (typeof bindingElemId !== 'string' && bindingElemId) {
        throw 'Invalid bindingElemId...bindingElemId: ' + bindingElemId;
    }
    if (typeof rootChildID !== "string" || rootChildID.length === 0) {
        throw 'Invalid rootChildId';
    }
    return [{
        view1: rootChildID,
        attr1: 'centerX',    // see AutoLayout.Attribute
        relation: 'equ',   // see AutoLayout.Relation
        view2: bindingElemId,
        attr2: 'centerX',    // see AutoLayout.Attribute
        constant: 0,
        multiplier: 1,
        priority: AutoLayout.Priority.REQUIRED
    }, {
        view1: rootChildID,
        attr1: 'centerY',    // see AutoLayout.Attribute
        relation: 'equ',   // see AutoLayout.Relation
        view2: bindingElemId,
        attr2: 'centerY',    // see AutoLayout.Attribute
        constant: 0,
        multiplier: 1,
        priority: AutoLayout.Priority.REQUIRED
    }, {
        view1: rootChildID,
        attr1: 'width',    // see AutoLayout.Attribute
        relation: 'equ',   // see AutoLayout.Relation
        view2: bindingElemId,
        attr2: "width",
        constant: 0,
        multiplier: 1,
        priority: AutoLayout.Priority.REQUIRED
    }, {
        view1: rootChildID,
        attr1: 'height',    // see AutoLayout.Attribute
        relation: 'equ',   // see AutoLayout.Relation
        view2: bindingElemId,
        attr2: "height",
        constant: 0,
        multiplier: 1,
        priority: AutoLayout.Priority.REQUIRED
    }
    ];
}

/**
 * Lays out the child elements of a parent element absolutely
 * using the visual format language.
 *
 * When the window is resized, the AutoLayout view is re-evaluated
 * and the child elements are resized and repositioned.
 *
 * @param {Element} parentElm Parent DOM element
 * @param {String|Array} constraints Either an array of raw constraints or  an array of one or more visual format strings
 */
function autoLayout(parentElm, constraints) {

    let isVisualFormat = constraints && isOneDimArray(constraints) && constraints.length > 0 && typeof constraints[0] === "string";
    let isOptionsFormat = constraints && isOneDimArray(constraints) && ((constraints.length > 0 && typeof constraints[0] === "object") || constraints.length === 0);

    let AutoLayout = window.AutoLayout;
    let view = new AutoLayout.View();
    if (isVisualFormat === true) {
        view.addConstraints(AutoLayout.VisualFormat.parse(constraints, {extended: true}));
    } else if (isOptionsFormat) {
        view.addConstraints(constraints);
    } else {
        throw 'Invalid parameters passed to autoLayout! no layout constraints specified';
    }

    let elements = {};

    for (let key in view.subViews) {
        let elm = document.getElementById(key);
        if (elm) {
            //elm.className += elm.className ? ' abs' : 'abs';
            addClass(elm, 'abs');
            elements[key] = elm;
        }
    }
    var updateLayout = function () {
        if (parentElm) {
            let horScrollBarShowing = parentElm.scrollWidth > parentElm.clientWidth;
            let vertScrollBarShowing = parentElm.scrollHeight > parentElm.clientHeight;
            let windowWidth = (vertScrollBarShowing ? window.innerWidth - getScrollBarWidth() : window.innerWidth);
            let windowHeight = (horScrollBarShowing ? window.innerHeight - getScrollBarWidth() : window.innerHeight);
            view.setSize(parentElm ? parentElm.clientWidth : windowWidth, parentElm ? parentElm.clientHeight : windowHeight - 1);
        } else {
            view.setSize(parentElm ? parentElm.clientWidth : window.innerWidth, parentElm ? parentElm.clientHeight : window.innerHeight - 1);
        }

        for (let key in view.subViews) {
            var subView = view.subViews[key];
            let elm = elements[key];
            if (elm) {
                setAbsoluteSizeAndPosition(elm, subView.left, subView.top, subView.width, subView.height);
            }
        }
    };

    window.addEventListener('resize', updateLayout);

    if (!parentElm) {
        let children = document.body.children;
        for (let i = 0; i < children.length; i++) {
            let par = children[i];
            let rs = new ResizeSensor(par, function () {
                //is scroll visible
                if (par) {
                    if (par.scrollHeight > par.clientHeight || par.scrollWidth > par.clientWidth) {
                        updateLayout();
                    }
                }
            });
        }
    }
    updateLayout();
    return updateLayout;
}

////////end weblay


/**
 *
 * VFL:
 * [a(b)] view a has same width as b
 * [a(==b/2)] view a has half the width of view b
 * Set the absolute size and position for a DOM element.
 *
 * To connect a view to another use [a]-[b]
 *
 *
 * To give a view same width as height:
 *
 * |-[a]-|
 * V:|-[a(a.width)]
 * Supported attributes are:
 *
 * .width
 * .height
 * .left
 * .top
 * .right
 * .bottom
 * .centerX
 * .centerY
 *
 * The next 2 commands will make the child stretch across the parent with system-standard margins at the edges
 * H:|-[child]-|
 * V:|-[child]-|
 *
 * The next 2 commands will make the child stretch across the parent with the specified margins at the edges
 * H:|-50-[child]-50-|
 * V:|-50-[child]-50-|
 *
 * Pin a child view to left edge of its parent:
 * H:|[child]
 *
 * Pin a child view to right edge of its parent:
 * H:[child]|
 *
 * Make view 100 points wide:
 * H:|[child(==100)]
 *
 * Make view at least 100 points wide:
 * H:|[child(>=100)]
 *
 *
 * Share size with another view:
 * Where childWidth is another view and child is the view that will share the width of `childWidth`
 * H:|[child(childWidth)]
 *
 * Specify width and priority:
 * H:|[child(childWidth@999)]
 *
 *
 * The DOM element must have the following CSS styles applied to it:
 * - position: absolute;
 * - padding: 0;
 * - margin: 0;
 *
 * @param {Element} elm DOM element.
 * @param {Number} left left position.
 * @param {Number} top top position.
 * @param {Number} width width.
 * @param {Number} height height.
 */
let transformAttr = ('transform' in document.documentElement.style) ? 'transform' : undefined;
transformAttr = transformAttr || (('-webkit-transform' in document.documentElement.style) ? '-webkit-transform' : 'undefined');
transformAttr = transformAttr || (('-moz-transform' in document.documentElement.style) ? '-moz-transform' : 'undefined');
transformAttr = transformAttr || (('-ms-transform' in document.documentElement.style) ? '-ms-transform' : 'undefined');
transformAttr = transformAttr || (('-o-transform' in document.documentElement.style) ? '-o-transform' : 'undefined');

function setAbsoluteSizeAndPosition(elm, left, top, width, height) {
    elm.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px; ' + transformAttr + ': translate3d(' + left + 'px, ' + top + 'px, 0px);');
}


/* global AutoLayout, attrKeys, xmlKeys, orientations, sizes, dummyDiv, dummyCanvas, PATH_TO_LAYOUTS_FOLDER, PATH_TO_COMPILER_SCRIPTS, rootCount, CssSizeUnits, CssSizeUnitsValues, PATH_TO_USER_IMAGES, FontStyle, Gravity, styleSheet, ListAdapter, Alignments */

/**
 * @param {Page} page
 * @param {HTMLElement} node
 * @param {Map} refIds
 * @param {string} parentId This is an optional parameter, and its only supplied when this View is the root layout of an xml include.
 * We use it to pass the id of the include element in the original layout to this View.
 * @returns {View}
 */
function View(page, node, refIds, parentId) {
    const zaId = node.id;
    if (typeof zaId === 'undefined' || zaId === null || zaId === '') {
        throw 'Please specify the view id properly';
    }

    if (typeof page.findViewById(zaId) !== 'undefined') {
        throw 'A view with this id(`' + zaId + '`) exists already';
    }

    this.htmlNode = node;
    this.topLevel = page.viewMap.size === 0 || !parentId;
    this.id = zaId;
    this.parentId = parentId; //(node.parentNode.getAttribute) ? node.parentNode.getAttribute(attrKeys.id).trim() : (parentId && typeof parentId === 'string' ? parentId : null);
    this.childrenIds = [];
    this.hasBgImage = refIds.get(attrKeys.mi_useAutoBg) ? true : false;


    if (refIds && refIds.size > 0) {
        let mg = refIds.get(attrKeys.layout_margin);
        let mh = refIds.get(attrKeys.layout_marginHorizontal);
        let mv = refIds.get(attrKeys.layout_marginVertical);


        this.margins = {
            top: refIds.get(attrKeys.layout_marginTop),
            bottom: refIds.get(attrKeys.layout_marginBottom),
            start: refIds.get(attrKeys.layout_marginStart),
            end: refIds.get(attrKeys.layout_marginEnd),
            horUnitsSame: true,
            verUnitsSame: true,
            horMarginDiff: function () {
                let s = parseNumberAndUnitsNoValidation(this.start, true);
                let e = parseNumberAndUnitsNoValidation(this.end, true);
               // console.log((parseFloat(s.number) - parseFloat(e.number)) + s.units);
                if (!this.horUnitsSame) {
                    throw 'start and end margins must be same when using `cx, scx, cxs` etc.'
                }
                return (parseFloat(s.number) - parseFloat(e.number)) + s.units;
            },
            verMarginDiff: function () {
                let t = parseNumberAndUnitsNoValidation(this.top, true);
                let b = parseNumberAndUnitsNoValidation(this.bottom, true);
                if (!this.verUnitsSame) {
                    throw 'top and bottom margins must be same when using `cy, tcy, cyt` etc.'
                }
                return (parseFloat(t.number) - parseFloat(b.number)) + t.units;
            }
        };
        if (mv) {
            if (isNumber(parseInt(mv))) {
                this.margins.top = mv;
                this.margins.bottom = mv;
            } else {
                throw new Error('Invalid value specified for the vertical margin on ' + this.constructor.name + '(' + this.id + ')');
            }
        }
        if (mh) {
            if (isNumber(parseInt(mh))) {
                this.margins.start = mh;
                this.margins.end = mh;
            } else {
                throw new Error('Invalid value specified for the horizontal margin on ' + this.constructor.name + '(' + this.id + ')');
            }
        }
        if (mg) {
            if (isNumber(parseInt(mg))) {
                this.margins.top = mg;
                this.margins.bottom = mg;
                this.margins.start = mg;
                this.margins.end = mg;
            } else {
                throw new Error('Invalid value specified for the margins on ' + this.constructor.name + '(' + this.id + ')');
            }
        }


        if (this.margins.top && startsWith(this.margins.top, "+")) {
            this.margins.top = this.margins.top.substr(1);
        }
        if (this.margins.bottom && startsWith(this.margins.bottom, "+")) {
            this.margins.bottom = this.margins.bottom.substr(1);
        }
        if (this.margins.start && startsWith(this.margins.start, "+")) {
            this.margins.start = this.margins.start.substr(1);
        }
        if (this.margins.end && startsWith(this.margins.end, "+")) {
            this.margins.end = this.margins.end.substr(1);
        }


        if (!this.margins.start || this.margins.start === '0') {
            this.margins.start = 0;
        }
        if (!this.margins.end || this.margins.end === '0') {
            this.margins.end = 0;
        }
        if (!this.margins.top || this.margins.top === '0') {
            this.margins.top = 0;
        }
        if (!this.margins.bottom || this.margins.bottom === '0') {
            this.margins.bottom = 0;
        }

        enforceSameUnitsOnMargins:{
            let ms = parseNumberAndUnitsNoValidation(this.margins.start, true);
            let me = parseNumberAndUnitsNoValidation(this.margins.end, true);
            let mt = parseNumberAndUnitsNoValidation(this.margins.top, true);
            let mb = parseNumberAndUnitsNoValidation(this.margins.bottom, true);

            let ms1 = refIds.get(attrKeys.layout_marginStart);
            let me1 = refIds.get(attrKeys.layout_marginEnd);
            let mt1 = refIds.get(attrKeys.layout_marginTop);
            let mb1 = refIds.get(attrKeys.layout_marginBottom);

            if (ms1 && me1) {
                if (ms.units !== me.units) {
                    //forgive a 0 margin with no units
                    if (parseInt(ms.number) !== 0 && parseInt(me.number) !== 0) {
                        this.margins.horUnitsSame = false;
                    }
                }
            }
            if (mt1 && mb1) {
                if (mt.units !== mb.units) {
                    //forgive a 0 margin with no units
                    if (parseInt(mt.number) !== 0 && parseInt(mb.number) !== 0) {
                        this.margins.verUnitsSame = false;
                    }
                }
            }
            if (ms1 && !me1) {
                this.margins.end = '0' + ms.units;
            }
            if (me1 && !ms1) {
                this.margins.start = '0' + me.units;
            }
            if (mt1 && !mb1) {
                this.margins.bottom = '0' + mt.units;
            }
            if (mb1 && !mt1) {
                this.margins.top = '0' + mb.units;
            }


        }


        /**
         * Values supported for width and height in xml.
         * Unitless values are supported, these are assumed to mean pixels
         * So you may say:<br>
         * width="2" or height="32"<br>
         * The following units are supported:
         * px, em and %.
         * So you may say:
         * width="322px" or height="308em" or width="5%"
         * Relational values are supported in the following format alone:
         * width="height"//makes the width and height same on the view
         * width="elemId" // makes the width of this view same as the width of the view with id=elemId
         * width="elemId*2" and width="2*elemId" are equivalent //makes the width of this view twice as large as the width of the view with id=elemId
         * width="elemId.width" // makes the width of this view same as the width of the view with id=elemId
         * width="elemId.height" // makes the width of this view same as the height of the view with id=elemId
         * width="4.2*elemId.width"// makes the width of this view 4.2 times the width of the view with id=elemId
         * width="0.25*elemId.height"// makes the width of this view 0.25 times the height of the view with id=elemId
         * width="elemId.width*3.8"// makes the width of this view 3.8 times the width of the view with id=elemId
         * width="elemId.height*3.142"// makes the width of this view 3.142 the height of the view with id=elemId
         *
         */
        this.width = refIds.get(attrKeys.layout_width);
        this.height = refIds.get(attrKeys.layout_height);


        if (this.width === sizes.MATCH_PARENT) {
            this.width = '100%';
        }
        if (this.height === sizes.MATCH_PARENT) {
            this.height = '100%';
        }

        changePxToUnitLess: {

            if (endsWith(this.width, 'px')) {
                this.width = parseFloat(this.width);
            }
            if (endsWith(this.height, 'px')) {
                this.height = parseFloat(this.height);
            }

        }

        this.dimRatio = -1; //Not specified... dimRatio is width/height
        this.wrapWidth = -1;
        this.wrapHeight = -1;
        const err = new Error();
        if (typeof this.width === 'undefined' || this.width === null || this.width === '') {
            err.name = 'UnspecifiedWidthError';
            err.message = 'Please specify the width for \'' + this.id + '\'';
            throw err;
        }

        if (typeof this.height === 'undefined' || this.height === null || this.height === '') {
            err.name = 'UnspecifiedHeightError';
            err.message = 'Please specify the height for \'' + this.id + '\'';
            throw err;
        }

        let thisObj = this;
        //store all references to other view ids here, alongside the property that references the id
        //So, the prop will be the key and the id will be the value
        refIds.forEach(function (attrValue, attrName, map) {

            switch (attrName) {
                case attrKeys.layout:
                    refIds.set(attrKeys.layout, attrValue);
                    break;
                case attrKeys.layout_width:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_width, attrValue);
                    }
                    break;
                case attrKeys.layout_height:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_height, attrValue);
                    }
                    break;
                case attrKeys.layout_maxWidth:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_maxWidth, attrValue);
                        //    this.style.addStyleElement("max-width", attrValue);
                    }
                    break;
                case attrKeys.layout_maxHeight:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_maxHeight, attrValue);
                    }
                    break;
                case attrKeys.layout_minWidth:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_minWidth, attrValue);
                    }
                    break;
                case attrKeys.layout_minHeight:
                    if (isNaN(parseInt(attrName))) {
                        refIds.set(attrKeys.layout_minHeight, attrValue);
                    }
                    break;

                case attrKeys.dimension_ratio:
                    if (isNumber(attrValue)) {
                        this.dimRatio = parseFloat(attrValue);
                        refIds.set(attrKeys.dimension_ratio, thisObj.dimRatio);
                    } else if (isDimensionRatio(attrValue) === true) {
                        let arr = attrValue.split(':');
                        let num = parseFloat(arr[0]);
                        let den = parseFloat(arr[1]);
                        if (num <= 0) {
                            throw new Error('Bad ratio specified! LHS can neither be 0 nor less than 0');
                        }
                        if (den <= 0) {
                            throw new Error('Bad ratio specified! RHS can neither be 0 nor less than 0');
                        }
                        thisObj.dimRatio = num / den;
                        refIds.set(attrKeys.dimension_ratio, thisObj.dimRatio);
                    } else {
                        throw new Error('Invalid dimension ratio specified on view with id: ' + thisObj.id);
                    }
                    break;
                default:
                    break;
            }
        });
    }

    this.refIds = refIds;

    if (!this.id) {
        throw 'Your view must have an id!';
    }
    if (typeof this.id !== 'string') {
        throw 'The view id must be a string!';
    }
    if (this.id.trim().length === 0) {
        throw 'The view id cannot be an empty string!';
    }


    //this.calculateWrapContentSizes(node);

    let rect = node.getBoundingClientRect();
    if (this.width === sizes.WRAP_CONTENT) {
        this.width = this.wrapWidth = rect.width;
    }
    if (this.height === sizes.WRAP_CONTENT) {
        this.height = this.wrapHeight = rect.height;
    }

    page.viewMap.set(this.id, this);
}


function isDimensionRatio(val) {
    if (!isNaN(val)) {
        val = val + ':1';
        return true;
    }
    let count = 0;
    for (let i = 0; i < val.length; i++) {
        if (val.substring(i, i + 1) === ':') {
            count++;
            if (count > 1) {
                return false;
            }
        }
    }
    if (count === 0 || count > 1) {
        return false;
    }
    let arr = val.split(':');
    return arr.length === 2 && !isNaN(arr[0]) && !isNaN(arr[1]);
}

View.prototype.isPopup = function(){
    let check = this.refIds.get(attrKeys.layout_popup);
    return typeof check !== "undefined" && (check === true || check === 'true') ;
};

View.prototype.makeBgImage = function () {
    let refIds = this.refIds;

    let useAutoBg = refIds.get(attrKeys.mi_useAutoBg);
    if (!useAutoBg || useAutoBg === 'false') {
        return;
    }

    let fgColor = refIds.get(attrKeys.mi_fg);
    let bgColor = refIds.get(attrKeys.mi_bg);
    let strokeWidth = refIds.get(attrKeys.mi_strokeWidth);
    let minSize = refIds.get(attrKeys.mi_minSize);
    let textArray = refIds.get(attrKeys.mi_textArray);
    let fontName = refIds.get(attrKeys.mi_fontName);
    let fontWeight = refIds.get(attrKeys.mi_fontWeight);//bold
    let fontStyle = refIds.get(attrKeys.mi_fontStyle);//italic
    let fontSize = refIds.get(attrKeys.mi_fontSize);
    let numShapes = refIds.get(attrKeys.mi_numShapes);
    let shapesDensity = refIds.get(attrKeys.mi_shapesDensity);
    let opacityValue = refIds.get(attrKeys.mi_opacity);
    let cacheAfterDraw = refIds.get(attrKeys.mi_cacheAfterDraw);
    let bgOpacityEnabled = refIds.get(attrKeys.mi_opaqueBg);//allow the opacity to affect the background color also.
    let mysteryMode = refIds.get(attrKeys.mi_mode);


    let textOnly = refIds.get(attrKeys.mi_textOnly);

    let style = null;
    if (fontStyle) {
        style = fontStyle;
        if (fontWeight) {
            style += (" " + fontWeight);
        }
    } else if (fontWeight) {
        style = fontWeight;
    }


    if (textArray) {
        if (typeof textArray === 'string') {
            try {
                textArray = JSON.parse(textArray);
            } catch (e) {
                throw e;
            }
        } else if (typeof textArray === "object") {
            //no action... some validation in the future
        }

    }

    cacheAfterDraw = cacheAfterDraw === true || cacheAfterDraw === 'true';
    textOnly = textOnly === true || textOnly === 'true';
    bgOpacityEnabled = bgOpacityEnabled === true || bgOpacityEnabled === 'true';


    let rect = this.htmlNode.getBoundingClientRect();

    let options = {
        width: rect.width,
        height: rect.height,
        fontName: fontName,
        fontSize: fontSize,
        fontStyle: style,
        fgColor: fgColor,
        bgColor: bgColor,
        mode: mysteryMode,
        numShapes: numShapes, // Total number of shapes to generate
        shapesDensity: shapesDensity, //Total number of shapes per unit area
        strokeWidth: strokeWidth,
        minSize: minSize, //The minimum size of the shapes drawn
        opacity: opacityValue,
        bgOpacityEnabled: bgOpacityEnabled,
        textArray: textArray, //An array of words that can be rendered randomly on the view.
        textOnly: textOnly, //Forces the view to render only text from the textArray attribute
        cacheAfterDraw: cacheAfterDraw //Renders the image once for a view and uses it subsequently.If false, this view will always have a new set of patterns whenever it is refreshed.
    };

    options.width = rect.width;
    options.height = rect.height;
    let background = new MysteryImage(options);
    background.draw();
    let stl = new Style('#' + this.id, []);
    stl.addFromOptions({
        "background-image": "url('" + background.getImage() + "')",
        "background-position": "0% 0%"
    });
    updateOrCreateSelectorInStyleSheet(styleSheet, stl);
    background.cleanup();
};

View.prototype.getValueAndPriority = function (value) {

    if (typeof value === 'undefined') {
        return value;
    }
    if (isNumber(value)) {
        return {
            id: value + "",
            defaultUsed: true,
            priority: AutoLayout.Priority.REQUIRED
        };
    }
    let index = value.indexOf('@');

    if (index === -1) {
        return {
            id: value,
            defaultUsed: true,
            priority: AutoLayout.Priority.REQUIRED
        };
    }
    if (index === 0) {
        throw 'Bad value for id';
    }

    return {
        id: value.substring(0, index),
        defaultUsed: false,
        priority: parseInt(value.substring(index + 1))
    };
};


/**
 * Applies necessary constraints to itself, where necessary
 *  Included layouts, templated layouts, and root layouts will need this a lot.
 * @param {Page} page
 * @return {*[]}
 */
View.prototype.layoutSelf = function (page) {

    let w = this.width;
    let h = this.height;
    let id = this.id;

    let maxWid = this.refIds.get(attrKeys.layout_maxWidth);
    let maxHei = this.refIds.get(attrKeys.layout_maxHeight);
    let minWid = this.refIds.get(attrKeys.layout_minWidth);
    let minHei = this.refIds.get(attrKeys.layout_minHeight);

    let ss = this.refIds.get(attrKeys.layout_constraintStart_toStartOf);
    let ee = this.refIds.get(attrKeys.layout_constraintEnd_toEndOf);
    let tt = this.refIds.get(attrKeys.layout_constraintTop_toTopOf);
    let bb = this.refIds.get(attrKeys.layout_constraintBottom_toBottomOf);
    let cx = this.refIds.get(attrKeys.layout_constraintCenterXAlign);
    let cy = this.refIds.get(attrKeys.layout_constraintCenterYAlign);


    let constraints = [];


    let idnpWid = this.getValueAndPriority(w);
    w = idnpWid.id;
    let priorityWidth = idnpWid.priority;

    this.setWidthConstraints(page, constraints, this.id, w, priorityWidth);

    let idnpHei = this.getValueAndPriority(h);
    h = idnpHei.id;
    let priorityHeight = idnpHei.priority;

    this.setHeightConstraints(page, constraints, this.id, h, priorityHeight);

    if (maxWid) {

        let idnpMaxWid = this.getValueAndPriority(maxWid);
        maxWid = idnpMaxWid.id;
        let priorityMaxWid = idnpMaxWid.priority;

        //set maxWidth
        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'leq',   // see AutoLayout.Relation
            constant: parseFloat(maxWid),
            multiplier: 1,
            priority: priorityMaxWid
        });
    }
    if (minWid) {
        let idnpMinWid = this.getValueAndPriority(minWid);
        minWid = idnpMinWid.id;
        let priorityMinWid = idnpMinWid.priority;

        //set minWidth
        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'geq',   // see AutoLayout.Relation
            constant: parseFloat(minWid),
            multiplier: 1,
            priority: priorityMinWid
        });
    }
    if (maxHei) {
        let idnpMaxHei = this.getValueAndPriority(maxHei);
        maxHei = idnpMaxHei.id;
        let priorityMaxHei = idnpMaxHei.priority;


        //set maxHeight
        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'leq',   // see AutoLayout.Relation
            constant: parseFloat(maxHei),
            multiplier: 1,
            priority: priorityMaxHei
        });
    }

    if (minHei) {

        let idnpMinHei = this.getValueAndPriority(minHei);
        minHei = idnpMinHei.id;
        let priorityMinHei = idnpMinHei.priority;

        //set minHeight
        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'geq',   // see AutoLayout.Relation
            constant: parseFloat(minHei),
            multiplier: 1,
            priority: priorityMinHei
        });
    }

    let view = this;

    if (ss) {
        let idnp = this.getValueAndPriority(ss);
        ss = idnp.id;
        let priority = idnp.priority;
        this.setLeftAlignSS(id, view.margins.start, 'parent', priority, constraints);
    }
    if (tt) {
        let idnp = this.getValueAndPriority(tt);
        tt = idnp.id;
        let priority = idnp.priority;
        this.setTopAlignTT(id, view.margins.top, 'parent', priority, constraints);
    }
    if (ee) {
        let idnp = this.getValueAndPriority(ee);
        ee = idnp.id;
        let priority = idnp.priority;
        this.setRightAlignEE(id, view.margins.end, 'parent', priority, constraints);
    }
    if (bb) {
        let idnp = this.getValueAndPriority(bb);
        bb = idnp.id;
        let priority = idnp.priority;
        this.setBottomAlignBB(id, view.margins.bottom, 'parent', priority, constraints);
    }

    if (cx) {
        let idnp = this.getValueAndPriority(cx);
        cx = idnp.id;
        let priority = idnp.priority;
        constraints.push({
            view1: id,
            attr1: 'centerX',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: null,
            attr2: 'centerX',    // see AutoLayout.Attribute
            constant: view.margins.start - view.margins.end,
            multiplier: 1,
            priority: priority
        });
    }
    if (cy) {
        let idnp = this.getValueAndPriority(cy);
        cy = idnp.id;
        let priority = idnp.priority;
        constraints.push({
            view1: id,
            attr1: 'centerY',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: null,
            attr2: 'centerY',    // see AutoLayout.Attribute
            constant: view.margins.top - view.margins.bottom,
            multiplier: 1,
            priority: priority
        });
    }

    return constraints;
};


/**
 * Manually layout the child views
 * @param {Page} page
 * @return {*[]}
 */
View.prototype.layoutChildren = function (page) {
    var w = this.width;
    var h = this.height;

    let constraints = [];
    /*
     A constraint definition has the following format:
        constraint: {
            view1: {String},
            attr1: {AutoLayout.Attribute},
            relation: {AutoLayout.Relation},
            view2: {String},
            attr2: {AutoLayout.Attribute},
            multiplier: {Number},
            constant: {Number},
            priority: {Number}(0..1000)
          }

    */
    for (let i = 0; i < this.childrenIds.length; i++) {
        let cid = this.childrenIds[i];
        let child = page.viewMap.get(cid);

        let ss = child.refIds.get(attrKeys.layout_constraintStart_toStartOf);
        let se = child.refIds.get(attrKeys.layout_constraintStart_toEndOf);
        let es = child.refIds.get(attrKeys.layout_constraintEnd_toStartOf);
        let ee = child.refIds.get(attrKeys.layout_constraintEnd_toEndOf);
        let tt = child.refIds.get(attrKeys.layout_constraintTop_toTopOf);
        let tb = child.refIds.get(attrKeys.layout_constraintTop_toBottomOf);
        let bt = child.refIds.get(attrKeys.layout_constraintBottom_toTopOf);
        let bb = child.refIds.get(attrKeys.layout_constraintBottom_toBottomOf);
        let cx = child.refIds.get(attrKeys.layout_constraintCenterXAlign);
        let cy = child.refIds.get(attrKeys.layout_constraintCenterYAlign);

        let scx = child.refIds.get(attrKeys.layout_constraintStart_toCenterX);
        let ecx = child.refIds.get(attrKeys.layout_constraintEnd_toCenterX);
        let cxs = child.refIds.get(attrKeys.layout_constraintCenterX_toStart);
        let cxe = child.refIds.get(attrKeys.layout_constraintCenterX_toEnd);


        let tcy = child.refIds.get(attrKeys.layout_constraintTop_toCenterY);
        let cyt = child.refIds.get(attrKeys.layout_constraintCenterY_toTop);
        let bcy = child.refIds.get(attrKeys.layout_constraintBottom_toCenterY);
        let cyb = child.refIds.get(attrKeys.layout_constraintCenterY_toBottom);


        let horBias = child.refIds.get(attrKeys.layout_horizontalBias);
        let verBias = child.refIds.get(attrKeys.layout_verticalBias);
        if (child.constructor.name === 'Guideline') {
            child.layoutGuide(constraints);
            continue;
        }


        /**
         * horizontal bias and centering. In the underlying autolayout.js library, I fund out the hard way
         * that when using centerX and centerY(?), one can shift the default behaviour using the multiplier, but
         * instead of the shift applying for 0 to 1 from the left to the right, it applies for 0 to 2.
         * Expected behaviour, assuming their own scale is different, then one would expect that:
         * When the multiplier is 0, the view's left should be at the left of the other view,
         * then when it is 1 the view's center should be at the center of the other view,
         * and when it is 2, the view's right should be the right of the other view. Instead:
         * Bug 1: when set to 0, the view's center is at the center of the other view, to correct this, I have to use a near
         * zero value instead of zero.
         * However unfortunately, the library's implementation is that, the view's center will be on the left of the other view!
         * This leads to other bugs also.
         * When the multiplier is 2(the max), the view's center is on the right side of the other view.
         */
        if (horBias) {
            if (isNumber(horBias)) {
                horBias = 2 * parseFloat(horBias);
                if (horBias < 0 || horBias > 2) {
                    throw "Invalid value set for horBias... should be between 0 and 1 on view.id=" + cid
                }
                //correct bug in underlying autolayout library
                if (horBias === 0) {
                    horBias = MIN_BIAS;
                }
            } else {
                throw "Invalid type set for horBias... should be a number between 0 and 1 view.id=" + cid
            }
        } else {
            horBias = 1;
        }
        if (verBias) {
            if (isNumber(verBias)) {
                verBias = 2 * parseFloat(verBias);
                if (verBias < 0 || verBias > 2) {
                    throw "Invalid value set for verBias... should be between 0 and 1 on view.id=" + cid
                }
                //correct bug in underlying autolayout library
                if (verBias === 0) {
                    verBias = MIN_BIAS;
                }
            } else {
                throw "Invalid type set for verBias... should be between 0 and 1 view.id=" + cid
            }
        } else {
            verBias = 1;
        }


        let maxWid = child.refIds.get(attrKeys.layout_maxWidth);
        let maxHei = child.refIds.get(attrKeys.layout_maxHeight);
        let minWid = child.refIds.get(attrKeys.layout_minWidth);
        let minHei = child.refIds.get(attrKeys.layout_minHeight);


        let w = child.width;
        let h = child.height;

        if (w === sizes.WRAP_CONTENT) {
            w = child.wrapWidth;
        }
        if (h === sizes.WRAP_CONTENT) {
            h = child.wrapHeight;
        }

        let idnpWid = this.getValueAndPriority(w);
        w = idnpWid.id;
        let priorityWid = idnpWid.priority;

        let hiddenViewForWidthId = undefined;
        let hiddenViewForHeightId = undefined;

//scx, ecx, cxs, cxe,|
        if (idnpWid.defaultUsed) {//user specified no priority
            if ((ss && ee) || (ss && es) || (ss && ecx) || (se && ee) || (se && es) || (se && ecx) ||
                (scx && ee) || (scx && es) || (scx && ecx)) {
                if (parseInt(w) === 0) {
                    priorityWid = AutoLayout.Priority.DEFAULTLOW;
                } else {
                    hiddenViewForWidthId = cid + "_dummywid_" + ULID.ulid();
                    if (ss) {
                        this.setLeftAlignSS(hiddenViewForWidthId, child.margins.start, ss, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (se) {
                        this.setLeftAlignSE(hiddenViewForWidthId, child.margins.start, se, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (scx) {
                        this.setLeftAlignCX(hiddenViewForWidthId, child.margins.start, scx, AutoLayout.Priority.REQUIRED, constraints);
                    }
                    if (ee) {
                        this.setRightAlignEE(hiddenViewForWidthId, child.margins.end, ee, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (es) {
                        this.setRightAlignES(hiddenViewForWidthId, child.margins.end, es, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (ecx) {
                        this.setRightAlignCX(hiddenViewForWidthId, child.margins.end, ecx, AutoLayout.Priority.REQUIRED, constraints);
                    }
                    constraints.push({
                        view1: hiddenViewForWidthId,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'equ',   // see AutoLayout.Relation
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: 1,
                        priority: 249
                    });
                    constraints.push({
                        view1: cid,
                        attr1: 'centerX',    // see AutoLayout.Attribute
                        relation: 'equ',   // see AutoLayout.Relation
                        view2: hiddenViewForWidthId,
                        attr2: 'centerX',    // see AutoLayout.Attribute
                        constant: child.margins.horMarginDiff(),
                        multiplier: horBias,
                        priority: AutoLayout.Priority.REQUIRED
                    });
                }
            }
        }

        this.setWidthConstraints(page, constraints, cid, w, priorityWid);

        let idnpHei = this.getValueAndPriority(h);
        h = idnpHei.id;
        let priorityHei = idnpHei.priority;
//tcy, bcy, cyt, cyb
        if (idnpHei.defaultUsed) {//user specified no priority
            if ((tt && bb) || (tt && bt) || (tt && bcy) || (tb && bb) || (tb && bt) || (tb && bcy) || (tcy && bb) || (tcy && bt) || (tcy && bcy)) {
                if (parseInt(h) === 0) {
                    priorityHei = AutoLayout.Priority.DEFAULTLOW;
                } else {
                    priorityHei = AutoLayout.Priority.REQUIRED;
                    hiddenViewForHeightId = cid + "_dummyhei_" + ULID.ulid();


                    if (tt) {
                        this.setTopAlignTT(hiddenViewForHeightId, child.margins.top, tt, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (tb) {
                        this.setTopAlignTB(hiddenViewForHeightId, child.margins.top, tb, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (tcy) {
                        this.setTopAlignCY(hiddenViewForHeightId, child.margins.top, tcy, AutoLayout.Priority.REQUIRED, constraints);
                    }

                    if (bb) {
                        this.setBottomAlignBB(hiddenViewForHeightId, child.margins.bottom, bb, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (bt) {
                        this.setBottomAlignBT(hiddenViewForHeightId, child.margins.bottom, bt, AutoLayout.Priority.REQUIRED, constraints);
                    } else if (bcy) {
                        this.setBottomAlignCY(hiddenViewForHeightId, child.margins.bottom, bcy, AutoLayout.Priority.REQUIRED, constraints);
                    }

                    constraints.push({
                        view1: hiddenViewForHeightId,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'equ',   // see AutoLayout.Relation
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: 1,
                        priority: 249
                    });

                    constraints.push({
                        view1: cid,
                        attr1: 'centerY',    // see AutoLayout.Attribute
                        relation: 'equ',   // see AutoLayout.Relation
                        view2: hiddenViewForHeightId,
                        attr2: 'centerY',    // see AutoLayout.Attribute
                        constant: child.margins.verMarginDiff(),
                        multiplier: verBias,
                        priority: AutoLayout.Priority.REQUIRED
                    });

                }

            }
        }
        this.setHeightConstraints(page, constraints, cid, h, priorityHei);
        this.setSizeBoundariesConstraints(page, constraints, cid, maxWid, minWid, maxHei, minHei);

        if (ss) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(ss);
                ss = idnp.id;
                let priority = idnp.priority;
                this.setLeftAlignSS(cid, child.margins.start, ss, priority, constraints);
            }
        }
        if (tt) {
            if (!hiddenViewForHeightId) {
                let idnp = this.getValueAndPriority(tt);
                tt = idnp.id;
                let priority = idnp.priority;
                this.setTopAlignTT(cid, child.margins.top, tt, priority, constraints);
            }
        }
        if (ee) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(ee);
                ee = idnp.id;
                let priority = idnp.priority;
                this.setRightAlignEE(cid, child.margins.end, ee, priority, constraints);
            }
        }
        if (bb) {
            if (!hiddenViewForHeightId) {
                let idnp = this.getValueAndPriority(bb);
                bb = idnp.id;
                let priority = idnp.priority;
                this.setBottomAlignBB(cid, child.margins.bottom, bb, priority, constraints);
            }
        }
        if (se) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(se);
                se = idnp.id;
                let priority = idnp.priority;
                this.setLeftAlignSE(cid, child.margins.start, se, priority, constraints);
            }
        }
        if (es) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(es);
                es = idnp.id;
                let priority = idnp.priority;
                this.setRightAlignES(cid, child.margins.end, es, priority, constraints);
            }
        }
        if (tb) {
            if (!hiddenViewForHeightId) {
                let idnp = this.getValueAndPriority(tb);
                tb = idnp.id;
                let priority = idnp.priority;
                this.setTopAlignTB(cid, child.margins.top, tb, priority, constraints);
            }
        }
        if (bt) {
            if (!hiddenViewForHeightId) {
                let idnp = this.getValueAndPriority(bt);
                bt = idnp.id;
                let priority = idnp.priority;
                this.setBottomAlignBT(cid, child.margins.bottom, bt, priority, constraints);
            }
        }
        if (cx) {
            let idnp = this.getValueAndPriority(cx);
            cx = idnp.id;
            let priority = idnp.priority;
            if (!child.margins.horUnitsSame) {
                throw '`cx` needs margin-start and margin-end to have same units!';
            }
            constraints.push({
                view1: cid,
                attr1: 'centerX',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: cx === 'parent' ? null : cx,
                attr2: 'centerX',    // see AutoLayout.Attribute
                constant: child.margins.horMarginDiff(),
                multiplier: horBias,
                priority: priority
            });
        }
        if (cy) {
            let idnp = this.getValueAndPriority(cy);
            cy = idnp.id;
            let priority = idnp.priority;
            if (!child.margins.verUnitsSame) {
                throw '`cy` needs margin-top and margin-bottom to have same units!';
            }
            constraints.push({
                view1: cid,
                attr1: 'centerY',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: cy === 'parent' ? null : cy,
                attr2: 'centerY',    // see AutoLayout.Attribute
                constant: child.margins.verMarginDiff(),
                multiplier: verBias,
                priority: priority
            });
        }

        if (scx) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(scx);
                scx = idnp.id;
                let priority = idnp.priority;
                this.setLeftAlignCX(cid, child.margins.start, scx, priority, constraints);
            }
        }
        if (ecx) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(ecx);
                ecx = idnp.id;
                let priority = idnp.priority;
                this.setRightAlignCX(cid, child.margins.end, ecx, priority, constraints);
            }
        }
        if (cxs) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(cxs);
                cxs = idnp.id;
                let priority = idnp.priority;
                if (!child.margins.horUnitsSame) {
                    throw '`cxs` needs margin-start and margin-end to have same units!';
                }
                this.setCXAlignLeft(cid, child.margins.horMarginDiff(), cxs, priority, constraints);
            }
        }
        if (cxe) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(cxe);
                cxe = idnp.id;
                let priority = idnp.priority;
                if (!child.margins.horUnitsSame) {
                    throw '`cxe` needs margin-start and margin-end to have same units!';
                }
                this.setCXAlignRight(cid, child.margins.horMarginDiff(), cxe, priority, constraints);
            }
        }


        if (tcy) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(tcy);
                tcy = idnp.id;
                let priority = idnp.priority;
                this.setTopAlignCY(cid, child.margins.top, tcy, priority, constraints);
            }
        }
        if (bcy) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(bcy);
                bcy = idnp.id;
                let priority = idnp.priority;
                this.setBottomAlignCY(cid, child.margins.bottom, bcy, priority, constraints);
            }
        }
        if (cyt) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(cyt);
                cyt = idnp.id;
                let priority = idnp.priority;
                if (!child.margins.verUnitsSame) {
                    throw '`bcy` needs margin-top and margin-bottom to have same units!';
                }
                this.setCYAlignTop(cid, child.margins.verMarginDiff(), cyt, priority, constraints);
            }
        }
        if (cyb) {
            if (!hiddenViewForWidthId) {
                let idnp = this.getValueAndPriority(cyb);
                cyb = idnp.id;
                let priority = idnp.priority;
                if (!child.margins.verUnitsSame) {
                    throw '`cyb` needs margin-top and margin-bottom to have same units!';
                }
                this.setCYAlignBottom(cid, child.margins.verMarginDiff(), cyb, priority, constraints);
            }
        }

    }

    return constraints;
};

/**
 * Sets the left align constraint for a left-left(start-start) align situation...works with pixels, percents
 * @param {string} view1 The view whose left is being constrained
 * @param {string|number} marginLeft The left margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the left-left anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setLeftAlignSS = function (view1, marginLeft, view2, priority, constraints) {
    marginLeft = (marginLeft === '0%' ? 0 : marginLeft);
    if (typeof marginLeft === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: marginLeft,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginLeft)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginLeft, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginLeft, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginLeft) / 100.0;


        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the left align constraint for a left-right(start-end) align situation...works with pixels, percents
 * @param {string} view1 The view whose left is being constrained
 * @param {*} marginLeft The left margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the left-right anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setLeftAlignSE = function (view1, marginLeft, view2, priority, constraints) {
    marginLeft = (marginLeft === '0%' ? 0 : marginLeft);
    if (typeof marginLeft === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: marginLeft,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginLeft)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginLeft, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'left',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginLeft, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginLeft) / 100.0;

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }
};



/**
 * Sets the right align constraint for a right-right(end-end) align situation...works with pixels, percents
 * @param {string} view1 The view whose right is being constrained
 * @param {*} marginRight The right margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the right-right anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setRightAlignEE = function (view1, marginRight, view2, priority, constraints) {
    marginRight = (marginRight === '0%' ? 0 : marginRight);
    if (typeof marginRight === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: -1 * marginRight,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginRight)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginRight, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'right',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginRight, "%");

        if (!isPct) {
            throw 'margin-right can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginRight) / 100.0;

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }
};


/**
 * Sets the right align constraint for a right-left(end-start) align situation...works with pixels, percents
 * @param {string} view1 The view whose right is being constrained
 * @param {*} marginRight The right margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the right-left anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setRightAlignES = function (view1, marginRight, view2, priority, constraints) {
    marginRight = (marginRight === '0%' ? 0 : marginRight);
    if (typeof marginRight === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: -1 * marginRight,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginRight)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginRight, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'right',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'left',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginRight, "%");

        if (!isPct) {
            throw 'margin-right can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginRight) / 100.0;

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }
};



/**
 * Sets the left align constraint for a left-center(start-center) align situation...works with pixels, percents
 * @param {string} view1 The view whose left is being constrained
 * @param {string|number} marginLeft The left margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the left-left anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setLeftAlignCX = function (view1, marginLeft, view2, priority, constraints) {
    marginLeft = (marginLeft === '0%' ? 0 : marginLeft);
    if (typeof marginLeft === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: marginLeft,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginLeft)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginLeft, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: parseFloat(marginLeft),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginLeft, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginLeft) / 100.0;


        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};

/**
 * Sets the center-x align constraint for a centerx-start(center-start) align situation...works with pixels, percents
 * @param {string} view1 The view whose center-x is being constrained to the left of another view
 * @param {string|number} margin The resultant margin (diff between left and right margins)... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the center_x-left anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setCXAlignLeft = function (view1, margin, view2, priority, constraints) {
    margin = (margin === '0%' ? 0 : margin);
    if (typeof margin === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            constant: margin,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(margin)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(margin, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(margin, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(margin) / 100.0;
        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the center-x align constraint for a centerx-end(center-end) align situation...works with pixels, percents
 * @param {string} view1 The view whose center-x is being constrained to the right(end) of another view
 * @param {string|number} margin The resultant margin (diff between left and right margins)... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the center_x-right anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setCXAlignRight = function (view1, margin, view2, priority, constraints) {
    margin = (margin === '0%' ? 0 : margin);
    if (typeof margin === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            constant: margin,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(margin)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(margin, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(margin, "%");

        if (!isPct) {
            throw 'margins can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(margin) / 100.0;
        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.LEFT,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the right align constraint for a right-center(end-center) align situation...works with pixels, percents
 * @param {string} view1 The view whose right is being constrained
 * @param {string|number} marginRight The right margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the right-center anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setRightAlignCX = function (view1, marginRight, view2, priority, constraints) {
    marginRight = (marginRight === '0%' ? 0 : marginRight);
    if (typeof marginRight === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: -marginRight,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginRight)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: -parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginRight, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
            constant: -parseFloat(marginRight),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginRight, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginRight) / 100.0;


        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.RIGHT,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.RIGHT,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.CENTERX,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Sets the top align constraint for a top-centerY align situation...works with pixels, percents
 * @param {string} view1 The view whose top is being constrained
 * @param {string|number} marginTop The top margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the top-cy anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setTopAlignCY = function (view1, marginTop, view2, priority, constraints) {
    marginTop = (marginTop === '0%' ? 0 : marginTop);
    if (typeof marginTop === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: marginTop,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginTop)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginTop, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginTop, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginTop) / 100.0;


        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'height',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }
};

/**
 * Sets the center-y align constraint for a centery-top align situation...works with pixels, percents
 * @param {string} view1 The view whose center-y is being constrained to the top of another view
 * @param {string|number} margin The resultant margin (diff between top and bottom margins)... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the center_y-top anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setCYAlignTop = function (view1, margin, view2, priority, constraints) {
    margin = (margin === '0%' ? 0 : margin);
    if (typeof margin === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            constant: margin,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(margin)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(margin, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(margin, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(margin) / 100.0;
        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the center-y align constraint for a centery-bottom align situation...works with pixels, percents
 * @param {string} view1 The view whose center-y is being constrained to the bottom of another view
 * @param {string|number} margin The resultant margin (diff between top and bottom margins)... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the center_y-bottom anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setCYAlignBottom = function (view1, margin, view2, priority, constraints) {
    margin = (margin === '0%' ? 0 : margin);
    if (typeof margin === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            constant: margin,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(margin)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(margin, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            constant: parseFloat(margin),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(margin, "%");

        if (!isPct) {
            throw 'margins can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(margin) / 100.0;
        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.TOP,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the bottom align constraint for a bottom-centerY align situation...works with pixels, percents
 * @param {string} view1 The view whose bottom is being constrained
 * @param {string|number} marginBottom The bottom margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the bottom-cy anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setBottomAlignCY = function (view1, marginBottom, view2, priority, constraints) {
    marginBottom = (marginBottom === '0%' ? 0 : marginBottom);
    if (typeof marginBottom === 'number') {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: -marginBottom,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginBottom)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: -parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginBottom, "px")) {
        constraints.push({
            view1: view1,
            attr1: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
            constant: -parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginBottom, "%");

        if (!isPct) {
            throw 'margin-left can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginBottom) / 100.0;


        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.BOTTOM,    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {

            constraints.push({
                view1: hiddenViewId,
                attr1: AutoLayout.Attribute.BOTTOM,   // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: AutoLayout.Attribute.CENTERY,    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};

/**
 * Sets the top align constraint for a top-top align situation...works with pixels, percents
 * @param {string} view1 The view whose top is being constrained
 * @param {*} marginTop The top margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the top-top anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setTopAlignTT = function (view1, marginTop, view2, priority, constraints) {
    marginTop = (marginTop === '0%' ? 0 : marginTop);
    if (typeof marginTop === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: marginTop,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginTop)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginTop, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginTop, "%");

        if (!isPct) {
            throw 'margin-top can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginTop) / 100.0;

        if (!val) {
            throw 'Invalid expression found for margin-top on id: ' + view1;
        }

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the top align constraint for a top-bottom align situation...works with pixels, percents
 * @param {string} view1 The view whose top is being constrained
 * @param {*} marginTop The top margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the top-bottom anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setTopAlignTB = function (view1, marginTop, view2, priority, constraints) {
    marginTop = (marginTop === '0%' ? 0 : marginTop);
    if (typeof marginTop === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: marginTop,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginTop)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginTop, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'top',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: parseFloat(marginTop),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginTop, "%");

        if (!isPct) {
            throw 'margin-top can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginTop) / 100.0;

        if (!val) {
            throw 'Invalid expression found for margin-top on id: ' + view1;
        }

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the bottom align constraint for a bottom-bottom align situation...works with pixels, percents
 * @param {string} view1 The view whose bottom is being constrained
 * @param {*} marginBottom The bottom margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the bottom-bottom anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setBottomAlignBB = function (view1, marginBottom, view2, priority, constraints) {

    if (typeof marginBottom === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: -1 * marginBottom,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginBottom)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginBottom, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'bottom',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginBottom, "%");

        if (!isPct) {
            throw 'margin-bottom can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginBottom) / 100.0;

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 * Sets the bottom align constraint for a bottom-top align situation...works with pixels, percents
 * @param {string} view1 The view whose bottom is being constrained
 * @param {*} marginBottom The bottom margin... supported units are px, % and no units(we assume px)
 * @param {string} view2 The id of the view being constrained to, or parent to refer to the parent element
 * @param {number} priority The priority of the bottom-bottom anchor constraint
 * @param {Array} constraints The array that holds the constraints generated here
 */
View.prototype.setBottomAlignBT = function (view1, marginBottom, view2, priority, constraints) {
    marginBottom = (marginBottom === '0%' ? 0 : marginBottom);
    if (typeof marginBottom === 'number') {
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: -1 * marginBottom,
            multiplier: 1,
            priority: priority
        });
    } else if (isNumber(marginBottom)) {//may be a number string
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else if (endsWith(marginBottom, "px")) {
        constraints.push({
            view1: view1,
            attr1: 'bottom',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: view2 === 'parent' ? null : view2,
            attr2: 'top',    // see AutoLayout.Attribute
            constant: -1 * parseFloat(marginBottom),
            multiplier: 1,
            priority: priority
        });
    } else {
        let isPct = endsWith(marginBottom, "%");

        if (!isPct) {
            throw 'margin-bottom can only be expressed in pixels, in percentage(%) or without units, on id: ' + view1;
        }

        let val = parseFloat(marginBottom) / 100.0;

        let hiddenViewId = view1 + "_dummy_" + ULID.ulid();
        if (view2 === 'parent') {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        } else {
            constraints.push({
                view1: hiddenViewId,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: view2,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: 1000
            });
            constraints.push({
                view1: view1,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: 1000
            });
        }
    }

};


/**
 *
 * @param {Page} page
 * @param {Array} constraints
 * @param {String} cid
 * @param {String|Number} maxWid
 * @param {String|Number} minWid
 * @param {String|Number} maxHei
 * @param {String|Number} minHei
 */
View.prototype.setSizeBoundariesConstraints = function (page, constraints, cid, maxWid, minWid, maxHei, minHei) {

    if (maxWid) {
        let idnpMaxWid = this.getValueAndPriority(maxWid);
        maxWid = idnpMaxWid.id;
        let priorityMaxWid = idnpMaxWid.priority;

        let i = -1;
        let vid = '';
        if (isNumber(maxWid)) {
            constraints.push({
                view1: cid,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'leq',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: parseFloat(maxWid),
                multiplier: 1,
                priority: priorityMaxWid
            });
        } else if (maxWid === 'parent' || this.childrenIds.indexOf(maxWid) !== -1) {//maxWid is an id of another element... so use that element's width for maxWid
            constraints.push({
                view1: cid,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'leq',   // see AutoLayout.Relation
                view2: maxWid === 'parent' ? null : maxWid,
                attr2: "width",
                constant: 0,
                multiplier: 1,
                priority: priorityMaxWid
            });
        } else if ((i = maxWid.indexOf(".")) !== -1 &&
            this.childrenIds.indexOf((vid = maxWid.substring(0, i))) !== -1) {//maxWid is elementId.width or elementId.height... so use that element's width for maxWid

            if (maxWid.substring(i + 1) === 'width') {
                constraints.push({
                    view1: cid,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'leq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "width",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMaxWid
                });
            } else if (maxWid.substring(i + 1) === 'height') {
                constraints.push({
                    view1: cid,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'leq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "height",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMaxWid
                });
            }

        } else {
            let parsedMaxWidth = parseNumberAndUnitsNoValidation(maxWid, true);

            if (parsedMaxWidth.number) {
                if (parsedMaxWidth.units === 'px') {

                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        constant: parseFloat(parsedMaxWidth.number),
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                        multiplier: 1,
                        priority: priorityMaxWid
                    });
                } else if (parsedMaxWidth.units === '%') {
                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'width',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMaxWidth.number) / 100.0,
                        priority: priorityMaxWid
                    });
                } else if (parsedMaxWidth.units === 'em') {
                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'width',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMaxWidth.number), //em is already a multiplier
                        priority: priorityMaxWid
                    });
                } else {
                    throw "Invalid values specified for the max-width units on view.id=" + cid
                }
            } else {
                throw "Bad value specified for the max-width units on view.id=" + cid + ", value=" + maxWid
            }
        }
    }


    if (minWid) {
        let idnpMinWid = this.getValueAndPriority(minWid);
        minWid = idnpMinWid.id;
        let priorityMinWid = idnpMinWid.priority;

        let i = -1;
        let vid = '';
        if (isNumber(minWid)) {
            constraints.push({
                view1: cid,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'geq',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: parseFloat(minWid),
                multiplier: 1,
                priority: priorityMinWid
            });
        } else if (minWid === 'parent' || this.childrenIds.indexOf(minWid) !== -1) {//minWid is an id of another element... so use that element's width for minWid
            constraints.push({
                view1: cid,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'geq',   // see AutoLayout.Relation
                view2: minWid === 'parent' ? null : minWid,
                attr2: "width",
                constant: 0,
                multiplier: 1,
                priority: priorityMinWid
            });
        } else if ((i = minWid.indexOf(".")) !== -1 &&
            this.childrenIds.indexOf((vid = minWid.substring(0, i))) !== -1) {//minWid is elementId.width or elementId.height... so use that element's width for minWid

            if (minWid.substring(i + 1) === 'width') {
                constraints.push({
                    view1: cid,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'geq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "width",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMinWid
                });
            } else if (minWid.substring(i + 1) === 'height') {
                constraints.push({
                    view1: cid,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'geq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "height",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMinWid
                });
            }

        } else {
            let parsedMinWidth = parseNumberAndUnitsNoValidation(minWid, true);
            if (parsedMinWidth.number) {
                if (parsedMinWidth.units === 'px') {
                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                        constant: parseFloat(parsedMinWidth.number),
                        multiplier: 1,
                        priority: priorityMinWid
                    });
                } else if (parsedMinWidth.units === '%') {
                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'width',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMinWidth.number) / 100.0,
                        priority: priorityMinWid
                    });
                } else if (parsedMinWidth.units === 'em') {
                    constraints.push({
                        view1: cid,
                        attr1: 'width',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'width',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMinWidth.number), //em is already a multiplier
                        priority: priorityMinWid
                    });
                } else {
                    throw "Invalid values specified for the min-width units on view.id=" + cid
                }
            } else {
                throw "Bad value specified for the min-width units on view.id=" + cid + ", value=" + minWid
            }
        }


    }

    if (maxHei) {
        let idnpMaxHei = this.getValueAndPriority(maxHei);
        maxHei = idnpMaxHei.id;
        let priorityMaxHei = idnpMaxHei.priority;

        let i = -1;
        let vid = '';
        if (isNumber(maxHei)) {
            constraints.push({
                view1: cid,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'leq',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: parseFloat(maxHei),
                multiplier: 1,
                priority: priorityMaxHei
            });
        } else if (maxHei === 'parent' || this.childrenIds.indexOf(maxHei) !== -1) {//maxHei is an id of another element... so use that element's height for maxHei
            constraints.push({
                view1: cid,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'leq',   // see AutoLayout.Relation
                view2: maxHei === 'parent' ? null : maxHei,
                attr2: "height",
                constant: 0,
                multiplier: 1,
                priority: priorityMaxHei
            });
        } else if ((i = maxHei.indexOf(".")) !== -1 &&
            this.childrenIds.indexOf((vid = maxHei.substring(0, i))) !== -1) {//maxHei is elementId.width or elementId.height... so use that element's width for maxWid

            if (maxHei.substring(i + 1) === 'width') {
                constraints.push({
                    view1: cid,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'leq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "width",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMaxHei
                });
            } else if (maxHei.substring(i + 1) === 'height') {
                constraints.push({
                    view1: cid,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'leq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "height",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMaxHei
                });
            }

        } else {
            let parsedMaxHeight = parseNumberAndUnitsNoValidation(maxHei, true);

            if (parsedMaxHeight.number) {
                if (parsedMaxHeight.units === 'px') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                        constant: parseFloat(parsedMaxHeight.number),
                        multiplier: 1,
                        priority: priorityMaxHei
                    });
                } else if (parsedMaxHeight.units === '%') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'height',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMaxHeight.number) / 100.0,
                        priority: priorityMaxHei
                    });
                } else if (parsedMaxHeight.units === 'em') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'leq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'height',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMaxHeight.number), //em is already a multiplier
                        priority: priorityMaxHei
                    });
                } else {
                    throw "Invalid values specified for the max-height units on view.id=" + cid
                }
            } else {
                throw "Bad value specified for the max-height units on view.id=" + cid + ", value=" + maxHei
            }
        }

    }
    if (minHei) {

        let idnpMinHei = this.getValueAndPriority(minHei);
        minHei = idnpMinHei.id;
        let priorityMinHei = idnpMinHei.priority;

        let i = -1;
        let vid = '';
        if (isNumber(minHei)) {
            constraints.push({
                view1: cid,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'geq',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: parseFloat(minHei),
                multiplier: 1,
                priority: priorityMinHei
            });
        } else if (minHei === 'parent' || this.childrenIds.indexOf(maxHei) !== -1) {//minHei is an id of another element... so use that element's height for minHei
            constraints.push({
                view1: cid,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'geq',   // see AutoLayout.Relation
                view2: minHei === 'parent' ? null : minHei,
                attr2: "height",
                constant: 0,
                multiplier: 1,
                priority: priorityMinHei
            });
        } else if ((i = minHei.indexOf(".")) !== -1 &&
            this.childrenIds.indexOf((vid = minHei.substring(0, i))) !== -1) {//maxHei is elementId.width or elementId.height... so use that element's width for maxWid

            if (minHei.substring(i + 1) === 'width') {
                constraints.push({
                    view1: cid,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'geq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "width",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMinHei
                });
            } else if (minHei.substring(i + 1) === 'height') {
                constraints.push({
                    view1: cid,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'geq',   // see AutoLayout.Relation
                    view2: vid === 'parent' ? null : vid,
                    attr2: "height",
                    constant: 0,
                    multiplier: 1,
                    priority: priorityMinHei
                });
            }

        } else {
            let parsedMinHeight = parseNumberAndUnitsNoValidation(minHei, true);

            if (parsedMinHeight.number) {
                if (parsedMinHeight.units === 'px') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                        constant: parseFloat(parsedMinHeight.number),
                        multiplier: 1,
                        priority: priorityMinHei
                    });
                } else if (parsedMinHeight.units === '%') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'height',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMinHeight.number) / 100.0,
                        priority: priorityMinHei
                    });
                } else if (parsedMinHeight.units === 'em') {
                    constraints.push({
                        view1: cid,
                        attr1: 'height',    // see AutoLayout.Attribute
                        relation: 'geq',   // see AutoLayout.Relation
                        view2: null,
                        attr2: 'height',    // see AutoLayout.Attribute
                        constant: 0,
                        multiplier: parseFloat(parsedMinHeight.number), //em is already a multiplier
                        priority: priorityMinHei
                    });
                } else {
                    throw "Invalid values specified for the min-height units on view.id=" + cid
                }
            } else {
                throw "Bad value specified for the min-height units on view.id=" + cid + ", value=" + minHei
            }
        }


    }
};

/**
 * Sometimes the width or height may come as a relational quantity instead of being given as a number or a number with units.
 * Some examples are,
 * width=some_id*4
 * width=some_id.width*2
 * height=some_id.height*0.35
 * height=0.81*some_id.width.
 *
 * We need to split this statements into tokens and extract information about the individual tokens.
 *
 * To avoid the scanner splitting floating point numbers, we will change the floating point on
 * some_id.width and some_id.height to % instead
 * and then we can safely split on the % and replace to floating point after the scan.
 * To optimize further, we could leave the % in place instead of replacing it back when done and deal with it as such in
 * code that uses this. To do this, we introduce an optional `optimize` parameter, which if true, leaves the '%' in place,
 * but if false will change it back to the original '.'
 * Thinking premature optimization? dont sue me :)
 * @param {string} dim
 * @param {boolean} optimize
 * @returns {Array} an array containing the input split into relevant tokens
 */
function quickScan(dim, optimize) {
    let hh = dim + "";
    //to avoid the scanner splitting floating point numbers, we will change the floating point on id.width and id.height to % instead
    // and then we can safely split on the % and replace to floating point after the scan
    hh = hh.replace(".width", "%width");
    hh = hh.replace(".height", "%height");

    let tokens = new Scanner(hh, true, ["*", "+", "%", "-"]).scan();
    if (optimize && optimize === true) {
        return tokens;
    }
    let i = tokens.indexOf("%");
    if (i !== -1) {
        tokens[i] = '.';//change % back to .
    }

    return tokens;
}

/**
 *
 * @param {Page} page
 * @param {Array} constraints
 * @param {String} id
 * @param {String|Number} w The width
 * @param {Number} priority
 */
View.prototype.setWidthConstraints = function (page, constraints, id, w, priority) {

    let mulInd = w.indexOf("*");
    let addInd = w.indexOf("+");
    let subInd = w.indexOf("-");
    let dotInd = w.indexOf(".");
    let parseObj;
    let selectedDimensionForAttr2IsWidth;


    if (isNumber(w)) {
        w = typeof w === 'string' ? parseFloat(w) : w;
        if (w === 0) {
            let child = page.viewMap.get(id);
            if (child.dimRatio !== -1) {
                constraints.push({
                    view1: id,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: id,
                    attr2: AutoLayout.Attribute.HEIGHT,
                    constant: 0,
                    multiplier: child.dimRatio,
                    priority: priority
                });
                return;
            }
        }
        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: null,
            attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
            constant: w,
            multiplier: 1,
            priority: priority
        });
    } else if ((parseObj = parseNumberAndUnitsNoValidation(w, true)).number) {
        let val = parseFloat(parseObj.number);
        if (val === 0) {
            let child = page.viewMap.get(id);
            if (child.dimRatio !== -1) {
                constraints.push({
                    view1: id,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: id,
                    attr2: AutoLayout.Attribute.HEIGHT,
                    constant: 0,
                    multiplier: child.dimRatio,
                    priority: priority
                });
                return;
            }
        }
        switch (parseObj.units) {
            case CssSizeUnits.PX:
                constraints.push({
                    view1: id,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: null,
                    attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                    constant: val,
                    multiplier: 1,
                    priority: priority
                });
                break;
            case CssSizeUnits.PCT:
                constraints.push({
                    view1: id,
                    attr1: 'width',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: null,
                    attr2: 'width',    // see AutoLayout.Attribute
                    constant: 0,
                    multiplier: val / 100.0,
                    priority: priority
                });
                break;
            default:
                throw 'width value is bad on id: ' + id + ", bad value is: " + w
        }

    } else if (w === 'height') {//width = height refers to the height of same element... so use this element's height for its width
        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: id,
            attr2: "height",
            constant: 0,
            multiplier: 1,
            priority: priority
        });
    } else if (w === 'parent' || this.childrenIds.indexOf(w) !== -1) {//width is an id of another element... so use that element's width for width
        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: w === 'parent' ? null : w,
            attr2: "width",
            constant: 0,
            multiplier: 1,
            priority: priority
        });
    }
    // width cannot be a combination of 2 operators * and - or + and - or + and *
    else if ((mulInd !== -1 && addInd !== -1) || (addInd !== -1 && subInd !== -1) || (mulInd !== -1 && subInd !== -1)) {
        throw 'width can only compare using one of `*` or `+` or `-`';
    } else if (mulInd !== -1 || addInd !== -1 || subInd !== -1) {
        let tokens = quickScan(w, true);
        if (tokens.length !== 3 && tokens.length !== 5) {
            throw 'invalid expression for width found on view.id=' + id + ", expression: " + w;
        }
        let mulIndex = tokens.indexOf("*");
        let sumIndex = tokens.indexOf("+");
        let subIndex = tokens.indexOf("-");


        if (mulIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {//format is number*elemid or number*elemid.width or number*elemid.height
                vid = tokens[2] === 'height' ? id : tokens[2];
                if (vid === 'width') {
                    throw 'the width is not yet initialized';
                }
                if (tokens.length === 3) {
                    selectedDimensionForAttr2IsWidth = tokens[2] !== 'height';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsWidth = tokens[4] === 'width';
                } else {
                    throw 'error in value specified for width on view.id=' + id + '... expression ' + w
                }
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid*number or height*number or elemid.width*number or elemid.height*number
                vid = tokens[0] === 'height' ? id : tokens[0];
                if (vid === 'width') {
                    throw 'the width is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the height of the same element
                    selectedDimensionForAttr2IsWidth = tokens[0] !== 'height';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsWidth = tokens[2] === 'width';
                } else {
                    throw 'error in value specified for width on view.id=' + id + '... expression ' + w
                }
            }

            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsWidth ? "width" : "height",
                constant: 0,
                multiplier: parseFloat(number),
                priority: priority
            });

        } else if (sumIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {//format is number+elemid or number+elemid.width or number+elemid.height
                vid = tokens[2] === 'height' ? id : tokens[2];
                if (vid === 'width') {
                    throw 'the width is not yet initialized';
                }
                if (tokens.length === 3) {
                    selectedDimensionForAttr2IsWidth = tokens[2] !== 'height';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsWidth = tokens[4] === 'width';
                } else {
                    throw 'error in value specified for width on view.id=' + cid + '... expression ' + w
                }
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid+number or number+elemid or width+number or elemid.width+number or elemid.height+number
                vid = tokens[0] === 'height' ? id : tokens[0];
                if (vid === 'width') {
                    throw 'the width is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the height of the same element
                    selectedDimensionForAttr2IsWidth = tokens[0] !== 'height';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsWidth = tokens[2] === 'width';
                } else {
                    throw 'error in value specified for width on view.id=' + id + '... expression ' + w
                }
            }

            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsWidth ? "width" : "height",
                constant: parseFloat(number),
                multiplier: 1,
                priority: priority
            });

        } else if (subIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {//format is number-elemid or number-elemid.width or number-elemid.height
                throw '`value-elem[.width|height]` is not allowed, but `elem[.width|height]-value is allowed on ` view.id=' + cid + '... expression ' + w
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid-number or width-number or elemid.width-number or elemid.height-number
                vid = tokens[0] === 'height' ? id : tokens[0];
                if (vid === 'width') {
                    throw 'the width is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the height of the same element
                    selectedDimensionForAttr2IsWidth = tokens[0] !== 'height';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsWidth = tokens[2] === 'width';
                } else {
                    throw 'error in value specified for width on view.id=' + id + '... expression ' + w
                }
            }

            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsWidth ? "width" : "height",
                constant: -1 * parseFloat(number),
                multiplier: 1,
                priority: priority
            });

        }
    } else if (mulInd === -1 && addInd === -1 && subInd === -1 && dotInd !== -1) {//test for width="some_id.width" or width="some_id.height"
        let lhs = w.substring(0, dotInd);
        let rhs = w.substring(dotInd + 1);
        if (rhs === 'width') {
            selectedDimensionForAttr2IsWidth = true;
        } else if (rhs === 'height') {
            selectedDimensionForAttr2IsWidth = false;
        } else {
            throw 'Strange expression found for width on id: ' + id + ', expression is: ' + w
        }
        let v2;
        if (lhs === 'parent' || rhs === 'parent') {
            v2 = null;
        } else if (this.childrenIds.indexOf(lhs) !== -1) {
            v2 = lhs; //you have the sibling!
        } else {
            throw 'Bad expression found for width on id: ' + id + ', expression is: ' + w
        }

        constraints.push({
            view1: id,
            attr1: 'width',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: v2,
            attr2: selectedDimensionForAttr2IsWidth ? "width" : "height",
            constant: 0,
            multiplier: 1,
            priority: priority
        });

    } else {
        throw 'invalid value for width on id: ' + id + ", bad value is: " + w;
    }

};

/**
 *
 * @param {Page} page
 * @param {Array} constraints
 * @param {String} id
 * @param {String|Number} h The height
 * @param {Number} priority
 */
View.prototype.setHeightConstraints = function (page, constraints, id, h, priority) {

    let mulInd = h.indexOf("*");
    let addInd = h.indexOf("+");
    let subInd = h.indexOf("-");
    let dotInd = h.indexOf(".");
    let parseObj;
    let selectedDimensionForAttr2IsHeight;

    if (isNumber(h)) {
        h = typeof h === 'string' ? parseFloat(h) : h;

        if (h === 0) {
            let child = page.viewMap.get(id);
            if (child.dimRatio !== -1) {
                constraints.push({
                    view1: id,
                    attr1: AutoLayout.Attribute.HEIGHT,    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: id,
                    attr2: AutoLayout.Attribute.WIDTH,
                    constant: 0,
                    multiplier: 1.0 / child.dimRatio,
                    priority: priority
                });
                return;
            }
        }
        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: null,
            attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
            constant: h,
            multiplier: 1,
            priority: priority
        });
    } else if ((parseObj = parseNumberAndUnitsNoValidation(h, true)).number) {
        let val = parseFloat(parseObj.number);
        if (val === 0) {
            let child = page.viewMap.get(id);
            if (child.dimRatio !== -1) {
                constraints.push({
                    view1: id,
                    attr1: AutoLayout.Attribute.HEIGHT,    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: id,
                    attr2: AutoLayout.Attribute.WIDTH,
                    constant: 0,
                    multiplier: 1.0 / child.dimRatio,
                    priority: priority
                });
                return;
            }
        }
        switch (parseObj.units) {
            case CssSizeUnits.PX:
                constraints.push({
                    view1: id,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: null,
                    attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                    constant: val,
                    multiplier: 1,
                    priority: priority
                });
                break;
            case CssSizeUnits.PCT:
                constraints.push({
                    view1: id,
                    attr1: 'height',    // see AutoLayout.Attribute
                    relation: 'equ',   // see AutoLayout.Relation
                    view2: null,
                    attr2: 'height',    // see AutoLayout.Attribute
                    constant: 0,
                    multiplier: val / 100.0,
                    priority: priority
                });
                break;
            default:
                throw 'height value is bad on id: ' + id + ", bad value is: " + h
        }

    } else if (h === 'width') {//height = width refers to the width of same element... so use this element's width for its height
        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: id,
            attr2: "width",
            constant: 0,
            multiplier: 1,
            priority: priority
        });
    } else if (h === 'parent' || this.childrenIds.indexOf(h) !== -1) {//height is an id of another element... so use that element's height for height
        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: h === 'parent' ? null : h,
            attr2: "height",
            constant: 0,
            multiplier: 1,
            priority: priority
        });
    }
    // width cannot be a combination of 2 operators * and - or + and - or + and *
    else if ((mulInd !== -1 && addInd !== -1) || (addInd !== -1 && subInd !== -1) || (mulInd !== -1 && subInd !== -1)) {
        throw 'width can only compare using one of `*` or `+` or `-`';
    } else if (mulInd !== -1 || addInd !== -1 || subInd !== -1) {
        let tokens = quickScan(h, true);

        if (tokens.length !== 3 && tokens.length !== 5) {
            throw 'invalid expression for height found on view.id=' + id + ',... ' + tokens;
        }

        let mulIndex = tokens.indexOf("*");
        let sumIndex = tokens.indexOf("+");
        let subIndex = tokens.indexOf("-");


        if (mulIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {//format is number*elemid or number*width or number*elemid.width or number*elemid.height
                vid = tokens[2] === 'width' ? id : tokens[2];
                if (vid === 'height') {
                    throw 'the height is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the width of the same element
                    selectedDimensionForAttr2IsHeight = tokens[2] !== 'width';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsHeight = tokens[4] === 'height';
                } else {
                    throw 'error in value specified for height on view.id=' + id + '... expression ' + h
                }
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid*number or width*number or elemid.width*number or elemid.height*number
                vid = tokens[0] === 'width' ? id : tokens[0];
                if (vid === 'height') {
                    throw 'the height is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the width of the same element
                    selectedDimensionForAttr2IsHeight = tokens[0] !== 'width';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsHeight = tokens[2] === 'height';
                } else {
                    throw 'error in value specified for height on view.id=' + id + '... expression ' + h
                }
            }

            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsHeight ? "height" : "width",
                constant: 0,
                multiplier: parseFloat(number),
                priority: priority
            });

        } else if (sumIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {//format is number+elemid or number+elemid.width or number+elemid.height
                vid = tokens[2] === 'width' ? id : tokens[2];
                if (vid === 'height') {
                    throw 'the height is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the width of the same element
                    selectedDimensionForAttr2IsHeight = tokens[2] !== 'width';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsHeight = tokens[4] === 'height';
                } else {
                    throw 'error in value specified for height on view.id=' + id + '... expression ' + h
                }
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid+number or elemid.width+number or elemid.height+number
                vid = tokens[0] === 'width' ? id : tokens[0];
                if (vid === 'height') {
                    throw 'the height is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the width of the same element
                    selectedDimensionForAttr2IsHeight = tokens[0] !== 'width';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsHeight = tokens[2] === 'height';
                } else {
                    throw 'error in value specified for height on view.id=' + id + '... expression ' + h
                }
            }

            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsHeight ? "height" : "width",
                constant: parseFloat(number),
                multiplier: 1,
                priority: priority
            });

        } else if (subIndex !== -1) {
            let vid;
            let number;
            if (isNumber(number = tokens[0])) {
                //format is number-elemid or number-elemid.width or number-elemid.height
                throw '`value-elem[.width|height]` is not allowed, but `elem[.width|height]-value is allowed on ` view.id=' + cid + '... expression ' + w
            } else if (isNumber(number = tokens[tokens.length - 1])) {//format is elemid+number or elemid.width+number or elemid.height+number
                vid = tokens[0] === 'width' ? id : tokens[0];
                if (vid === 'height') {
                    throw 'the height is not yet initialized';
                }
                if (tokens.length === 3) {
                    //if the first token is width, then it refers to the width of the same element
                    selectedDimensionForAttr2IsHeight = tokens[0] !== 'width';
                } else if (tokens.length === 5) {
                    selectedDimensionForAttr2IsHeight = tokens[2] === 'height';
                } else {
                    throw 'error in value specified for height on view.id=' + id + '... expression ' + h
                }
            }

            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: vid === 'parent' ? null : vid,
                attr2: selectedDimensionForAttr2IsHeight ? "height" : "width",
                constant: -1 * parseFloat(number),
                multiplier: 1,
                priority: priority
            });

        }
    } else if (mulInd === -1 && addInd === -1 && dotInd !== -1) {//test for width="some_id.width" or width="some_id.height"
        let lhs = h.substring(0, dotInd);
        let rhs = h.substring(dotInd + 1);
        if (rhs === 'height') {
            selectedDimensionForAttr2IsHeight = true;
        } else if (rhs === 'width') {
            selectedDimensionForAttr2IsHeight = false;
        } else {
            throw 'Strange expression found for height on id: ' + id + ', expression is: ' + h
        }
        let v2;
        if (lhs === 'parent' || rhs === 'parent') {
            v2 = null;
        } else if (this.childrenIds.indexOf(lhs) !== -1) {
            v2 = lhs; //you have the sibling!
        } else {
            throw 'Bad expression found for height on id: ' + id + ', expression is: ' + h
        }

        constraints.push({
            view1: id,
            attr1: 'height',    // see AutoLayout.Attribute
            relation: 'equ',   // see AutoLayout.Relation
            view2: v2,
            attr2: selectedDimensionForAttr2IsHeight ? "height" : "width",
            constant: 0,
            multiplier: 1,
            priority: priority
        });

    } else {
        throw 'invalid value for height on id: ' + id + ", bad value is: " + h;
    }

};


function isHTMLTagName(tagName) {
    if (typeof tagName === 'string') {
        const tags = 'a b u i body head header h1 h2 h3 h4 h5 h6 style title div p span button checkbox radio input label textarea select legend ul ol li link table tbody thead tfoot tr td th option optgroup video meta img hr picture pre script section small strong noscript object canvas caption blockquote article audio time var cite code iframe nav noframes menu br'.split(' ');
        return tags.indexOf(tagName.trim().toLowerCase()) > -1;
    }
    return false;
}

function getSignedValue(val) {
    if (typeof val === 'undefined') {
        return '+0.0';
    }
    if (typeof val === 'string') {
        let p = parseInt(val);
        return isNaN(p) ? "+0.0" : (p >= 0 ? "+" + p : "" + p);
    }
    if (typeof val === 'number') {
        return (val > 0 ? "+" + val : "-" + val);
    }
}

/**
 *
 * @returns {string}
 */
View.prototype.toHTML = function () {
    let outerHtmlHackElem = null;
    const nodeName = this.htmlNode.nodeName.toLowerCase();
    if (isHTMLTagName(nodeName)) {

        if (nodeName === 'li') {
            outerHtmlHackElem = document.createElement('ul');
        } else if (nodeName === 'tbody' || nodeName === 'thead' || nodeName === 'tfoot') {
            outerHtmlHackElem = document.createElement('table');
        } else if (nodeName === 'tr') {
            outerHtmlHackElem = document.createElement('table');
        } else if (nodeName === 'td' || nodeName === 'th') {
            outerHtmlHackElem = document.createElement('tr');
        } else if (nodeName === 'option') {
            outerHtmlHackElem = document.createElement('select');
        } else {//A div should be able to wrap most of the remaining element types
            outerHtmlHackElem = document.createElement('div');
        }
        outerHtmlHackElem.appendChild(this.htmlNode);
        return outerHtmlHackElem.innerHTML;
    } else {
        throw 'Invalid HTML element!';
    }

};


View.prototype.calculateWrapContentSizes = function (node) {
    //bold 12pt arial;
    let w = this.refIds.get(attrKeys.layout_width);
    let h = this.refIds.get(attrKeys.layout_height);


    if (w === sizes.WRAP_CONTENT && h === sizes.WRAP_CONTENT) {
        let rect = node.getBoundingClientRect();
        this.wrapWidth = (0.813 * rect.width) + 'px';
        this.wrapHeight = (0.825 * rect.height) + 'px';
        alert(this.wrapWidth + " , " + this.wrapHeight);
    } else if (w !== sizes.WRAP_CONTENT && h === sizes.WRAP_CONTENT) {
        node.style.width = w;
        let rect = node.getBoundingClientRect();
        this.wrapHeight = (0.825 * rect.height) + 'px';
    } else if (w === sizes.WRAP_CONTENT && h !== sizes.WRAP_CONTENT) {
        node.style.height = h;
        let rect = node.getBoundingClientRect();
        this.wrapWidth = (0.813 * rect.width) + 'px';
    }

};


Guideline.prototype = Object.create(View.prototype);
Guideline.prototype.constructor = Guideline;
IncludedView.prototype = Object.create(View.prototype);
IncludedView.prototype.constructor = IncludedView;


/**
 * @param {Page} page
 * @param {HTMLElement} node
 * @param {Map} refIds
 * @param {string} parentId This is an optional parameter, and its only supplied when this View is the root layout of an xml include.
 * We use it to pass the id of the include element in the original layout to this View.
 * @returns {View}
 */
function Guideline(page, node, refIds, parentId) {
    View.call(this, page, node, refIds, parentId);
    let w = refIds.get(attrKeys.layout_width);
    let h = refIds.get(attrKeys.layout_height);

    if (w !== sizes.WRAP_CONTENT) {
        this.refIds.set(attrKeys.layout_width, sizes.WRAP_CONTENT);
    }
    if (h !== sizes.WRAP_CONTENT) {
        this.refIds.set(attrKeys.layout_height, sizes.WRAP_CONTENT);
    }
    addClass(node, GUIDE_CLASS);
}


Guideline.prototype.calculateWrapContentSizes = function (node) {
    const orientation = this.refIds.get(attrKeys.orientation);
    if (typeof orientation === 'undefined' || orientation === null || orientation === '') {
        throw 'Please specify the orientation of the Guideline whose id is `' + this.id + '`';
    }

    if (orientation === orientations.VERTICAL) {
        this.wrapWidth = '1';
        this.wrapHeight = sizes.MATCH_PARENT;
    } else {
        this.wrapWidth = sizes.MATCH_PARENT;
        this.wrapHeight = '1';
    }
};

Guideline.prototype.layoutGuide = function (constraints) {
    const orientation = this.refIds.get(attrKeys.orientation);
    if (!orientation || orientation === '') {
        throw 'Please specify the orientation of the Guideline whose id is `' + this.id + '`';
    }

    let id = this.id;
    let guidePct = this.refIds.get(attrKeys.layout_constraintGuide_percent);
    let guideBegin = this.refIds.get(attrKeys.layout_constraintGuide_begin);
    let guideEnd = this.refIds.get(attrKeys.layout_constraintGuide_end);


    if (isEmpty(guidePct) && isEmpty(guideBegin) && isEmpty(guideEnd)) {
        throw 'Please specify either constraint-guide-(percentage|begin|end) for the Guideline whose id is `' + this.id + '`';
    }

    let val = 0;

    if (!isEmpty(guidePct)) {
        if (!isEmpty(guideBegin) || !isEmpty(guideEnd)) {
            throw 'Conflicting guide constraints! only one of guide_percent, guide_begin and guide_end hould be set!'
        }

        if (endsWith(guidePct, '%')) {
            if (isNaN(val = parseFloat(guidePct))) {
                throw 'Please specify a floating point number between 0 and 1 to signify 0 - 100% of width';
            }
            val = val > 1 ? val / 100.0 : val;
        } else if (isNaN(val = parseFloat(guidePct))) {
            throw 'Please specify a floating point number between 0 and 1 to signify 0 - 100% of width';
        } else {
            if (val > 1) {
                throw 'The guide percentage may not be greater than 1';
            } else if (val < 0) {
                throw 'The guide percentage may not be less than 0';
            }
        }

        if (orientation === orientations.VERTICAL) {
            //vfl.append('H:|-' + val + '-[' + this.id + '(1)]\nV:|[' + this.id + ']-|');
            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "height",
                constant: 0,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });

            let hiddenViewId = id + "_dummy_" + ULID.ulid();
            constraints.push({
                view1: hiddenViewId,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'width',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: id,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });

        } else if (orientation === orientations.HORIZONTAL) {
            // vfl.append('H:|[' + this.id + ']|\nV:|-' + val + '-[' + this.id + '(1)]');
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "width",
                constant: 0,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });

            let hiddenViewId = id + "_dummy_" + ULID.ulid();
            constraints.push({
                view1: hiddenViewId,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: hiddenViewId,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'height',    // see AutoLayout.Attribute
                constant: 1,
                multiplier: val,
                priority: AutoLayout.Priority.REQUIRED
            });
            constraints.push({
                view1: id,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: hiddenViewId,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: 0,
                multiplier: 1,
                priority: AutoLayout.Priority.REQUIRED
            });
        }

    }

    if (!isEmpty(guideBegin)) {
        if (!isEmpty(guidePct) || !isEmpty(guideEnd)) {
            throw 'Conflicting guide constraints! only one of `guide_percent`, `guide_begin` and `guide_end` should be set!'
        }

        if (isNumber(guideBegin) || (endsWith(guideBegin, "px") && isNumber(parseInt(guideBegin)))) {
            guideBegin = parseFloat(guideBegin);
        } else {
            throw "`guide_begin` must be a unitless number or be specified in pixels"
        }

        if (isNaN(guideBegin)) {
            throw "please specify a number for `guide_begin`"
        }

        val = guideBegin;


        if (orientation === orientations.VERTICAL) {
            // vfl.append('H:|-' + val + '-[' + this.id + '(1)]\nV:|[' + this.id + ']-|');

            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "height",
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: 1000
            });

            constraints.push({
                view1: id,
                attr1: 'left',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'left',    // see AutoLayout.Attribute
                constant: val,
                multiplier: 1,
                priority: 1000
            });

        } else if (orientation === orientations.HORIZONTAL) {
            // vfl.append('H:|[' + this.id + ']|\nV:|-' + val + '-[' + this.id + '(1)]');
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "width",
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: 1000
            });

            constraints.push({
                view1: id,
                attr1: 'top',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'top',    // see AutoLayout.Attribute
                constant: val,
                multiplier: 1,
                priority: 1000
            });

        }

    }

    if (!isEmpty(guideEnd)) {
        if (!isEmpty(guidePct) || !isEmpty(guideBegin)) {
            throw 'Conflicting guide constraints! only one of `guide_percent`, `guide_begin` and `guide_end` should be set!'
        }

        if (isNumber(guideEnd) || (endsWith(guideEnd, "px") && isNumber(parseInt(guideEnd)))) {
            guideEnd = parseFloat(guideEnd);
        } else {
            throw "`guide_end` must be a unitless number or be specified in pixels"
        }


        if (isNaN(guideEnd)) {
            throw "please specify a number for `guide_end`"
        }

        val = guideEnd;


        if (orientation === orientations.VERTICAL) {
            // vfl.append('H:|-0-[' + this.id + '(1)]-' + val + '-|\nV:|[' + this.id + ']-0-|');

            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "height",
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: 1000
            });

            constraints.push({
                view1: id,
                attr1: 'right',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'right',    // see AutoLayout.Attribute
                constant: -val,
                multiplier: 1,
                priority: 1000
            });

        } else if (orientation === orientations.HORIZONTAL) {
            // vfl.append('H:|[' + this.id + ']|\nV:|-' + val + '-[' + this.id + '(1)]');
            constraints.push({
                view1: id,
                attr1: 'width',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: "width",
                constant: 0,
                multiplier: 1,
                priority: 1000
            });
            constraints.push({
                view1: id,
                attr1: 'height',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: AutoLayout.Attribute.NOTANATTRIBUTE,
                constant: 0.1,
                multiplier: 1,
                priority: 1000
            });

            constraints.push({
                view1: id,
                attr1: 'bottom',    // see AutoLayout.Attribute
                relation: 'equ',   // see AutoLayout.Relation
                view2: null,
                attr2: 'bottom',    // see AutoLayout.Attribute
                constant: -val,
                multiplier: 1,
                priority: 1000
            });

        }

    }

};


/**
 * @param {Page} page
 * @param {HTMLElement} node
 * @param {Map} refIds
 * @param {string} parentId This is an optional parameter, and its only supplied when this View is the root layout of an xml include.
 * We use it to pass the id of the include element in the original layout to this View.
 * @returns {View}
 */
function IncludedView(page, node, refIds, parentId) {
    View.call(this, page, node, refIds, parentId);
    let layout = node.getAttribute(attrKeys.layout);
    if (!layout || typeof layout !== 'string') {
        throw 'An included layout must be the name of a valid xml file in the `' + PATH_TO_LAYOUTS_FOLDER + '` folder';
    }
    let len = layout.length;
    if (layout.substring(len - 4) !== '.xml') {
        layout += '.xml';
    }
    let mp = new Parser(page, layout, this.id);
    //this.constraints = mp.constraints;
}

IncludedView.prototype.calculateWrapContentSizes = function (node) {
    this.wrapWidth = 300;
    this.wrapHeight = 320;
};

function is2DArray(arr) {

    if (Object.prototype.toString.call(arr) === '[object Array]') {

        for (let i = 0; i < arr.length; i++) {
            if (Object.prototype.toString.call(arr[i]) !== '[object Array]') {
                return false;
            }
        }
        return true;
    }

    return false;
}


function attributeNotEmpty(attrVal) {
    if (attrVal && attrVal.trim().length > 0) {
        return true;
    }
    return false;
}

function attributeEmpty(attrVal) {
    if (!attrVal || attrVal.trim().length === 0) {
        return true;
    }
    return false;
}


// stringutils
/**
 *
 * @param {string} input The string input to be split
 * @param {boolean} includeTokensInOutput If true, the tokens are retained in the splitted output.
 * @param {String[]} tokens The tokens to be employed in splitting the original string.
 * @returns {Scanner}
 */
function Scanner(input, includeTokensInOutput, tokens) {
    this.input = input;
    this.includeTokensInOutput = includeTokensInOutput;
    this.tokens = tokens;
}

Scanner.prototype.scan = function () {
    let inp = this.input;

    let parse = [];
    this.tokens.sort(function (a, b) {
        return b.length - a.length; //ASC, For Descending order use: b - a
    });
    for (let i = 0; i < inp.length; i++) {

        for (let j = 0; j < this.tokens.length; j++) {
            let token = this.tokens[j];
            let len = token.length;
            if (len > 0 && i + len <= inp.length) {
                let portion = inp.substring(i, i + len);
                if (portion === token) {
                    if (i !== 0) {//avoid empty spaces
                        parse[parse.length] = inp.substring(0, i);
                    }
                    if (this.includeTokensInOutput) {
                        parse[parse.length] = token;
                    }
                    inp = inp.substring(i + len);
                    i = -1;
                    break;
                }
            }
        }
    }

    if (inp.length !== 0) {
        parse[parse.length] = inp;
    }
    return parse;
};

/**
 *
 * @param {string} str The initialization string.
 * @returns {StringBuffer}
 */
function StringBuffer(str) {
    if (str && typeof str === 'string') {
        this.dataArray = new Array(str);
    } else {
        this.dataArray = new Array(str);
    }
}

StringBuffer.prototype.append = function (str) {
    this.dataArray.push(str);
    return this;
};
StringBuffer.prototype.toString = function () {
    return this.dataArray.join("");
};
StringBuffer.prototype.length = function () {
    return this.dataArray.length;
};


let cloneText = function (originalText) {
    if (originalText && typeof originalText === 'string') {
        return (' ' + originalText).slice(1);
    }
    throw new Error('Invalid text supplied.');
};

/**
 * @param str The string in consideration
 * @param startItem The string to check for at the start of <code>str</code>
 * @return true if the variable <code>str</code> ends with variable <code>startItem</code>
 */
function startsWith(str, startItem) {
    if (typeof str === "string" && typeof startItem === "string") {
        const len = str.length;
        const otherLen = startItem.length;
        if (len === otherLen) {
            return str === startItem;
        } else if (len < otherLen) {
            return false;
        } else {
            return str.indexOf(startItem, 0) === 0;
        }
    } else {
        return false;
    }
}


/**
 * @param str The string in consideration
 * @param endItem The string to check for at the end of <code>str</code>
 * @return true if the variable <code>str</code> ends with variable <code>endItem</code>
 */
function endsWith(str, endItem) {
    if (typeof str === "string" && typeof endItem === "string") {
        const len = str.length;
        const otherLen = endItem.length;
        if (len === otherLen) {
            return str === endItem;
        } else if (len < otherLen) {
            return false;
        } else {
            return str.lastIndexOf(endItem) === len - otherLen;
        }
    } else {
        return false;
    }
}


/**
 *
 * N.B..The name of this method should have been <code>contains(args..)</code>
 * but this name does not work, so the developer imagines that it could be a
 * reserved word in Javascript.
 * @param str The string in consideration
 * @param inneritem The string to check for inside <code>str</code>
 * @return true if the variable <code>str</code> contains variable <code>item</code>
 */
function contain(str, inneritem) {
    if (typeof str === "string" && typeof inneritem === "string") {
        let len = str.length;
        let otherLen = inneritem.length;
        if (len === otherLen) {
            return str === inneritem;
        } else if (len < otherLen) {
            return false;
        } else {
            return str.indexOf(inneritem, 0) !== -1;
        }
    } else {
        return false;
    }
}//end function


/**
 * @param str The string in consideration
 * @param endItems An array containing the strings to check for at the end of <code>str</code>
 * @return true if the variable <code>str</code> ends with any of the variables in <code>endItems</code>
 */
function endsWithAnyOf(str, endItems) {
    var len = endItems.length;
    for (var i = 0; i < len; i++) {
        if (endsWith(str, endItems[i])) {
            return true;
        }
    }
    return false;
}//end function

/**
 * @param str The string in consideration
 * @param endItems An array containing the strings to check for at the end of <code>str</code>
 * @return the index of the first item in the endItems which is found to end this string or -1 if none is found
 * to end it.
 */
function indexOfEnder(str, endItems) {
    var len = endItems.length;
    for (var i = 0; i < len; i++) {
        if (endsWith(str, endItems[i])) {
            return i;
        }
    }
    return -1;
}//end function

/**
 * @param str The string in consideration
 * @param startItems An array containing the strings to check for at the start of <code>str</code>
 * @return true if the variable <code>str</code> starts with any of the variables in <code>startItems</code>
 */
function startsWithAnyOf(str, startItems) {
    var len = startItems.length;
    for (var i = 0; i < len; i++) {
        if (startsWith(str, startItems[i])) {
            return true;
        }
    }
    return false;

}//end function

/**
 * @param str The string in consideration
 * @param startItems An array containing the strings to check for at the start of <code>str</code>
 * @return the index of the first item in the startItems array which is found to start this string or -1
 * if none is found to start it
 */
function indexOfStarter(str, startItems) {
    var len = startItems.length;
    for (var i = 0; i < len; i++) {
        if (startsWith(str, startItems[i])) {
            return i;
        }
    }
    return -1;

}//end function

/**
 * @param str The string in consideration
 * @param innerItems An array containing the strings to check for inside <code>str</code>
 * @return true if the variable <code>str</code> contains any of the variables in <code>endItems</code>
 */
function containsAnyOf(str, innerItems) {
    const len = innerItems.length;
    for (let i = 0; i < len; i++) {
        if (contain(str, innerItems[i])) {
            return true;
        }

    }
    return false;

}//end function


/**
 * @param str The string to reverse
 * @return the string in reversed order.
 */
function reverse(str) {
    var len = str.length;
    var reversed = '';
    for (var i = len - 1; i >= 0; i--) {
        reversed = reversed + str.charAt(i);
    }


    return reversed;
}//end function

/**
 *
 * @param {type} input The input string to check
 * @returns {Boolean} true if the input contains only
 * white spaces or is null.
 */
function isWhiteSpacesOnly(input) {
    if (input === null) {
        return true;
    }
    if (!input) {
        return true;
    }
    if (/\S/.test(input)) {
        return false;
    }

    return true;
}

/**
 *
 * @param {string} input The input string to check
 * @returns {Boolean} true if the input contains only
 * white spaces or is null or is undefined.
 */
function isEmpty(input) {
    if (!input) {
        return true;
    }
    return !/\S/.test(input);
}


/**
 * This function returns true if the supplied param is a number string
 * or a number.
 * For example:
 * isNumber('2') will return true as will isNumber(2).
 * But isNumber('2a') will return false
 * @param {string|Number} number
 * @returns {Boolean}
 */
let isNumber = function (number) {
    return number !== null && number !== '' && isNaN(number) === false;
};

function isOneDimArray(array) {
    return Object.prototype.toString.call(array) === '[object Array]';
}

//Dom Utils


function addClass(element, className) {
    if (element.className.length === 0) {
        element.className = className;
    } else {
        if (element.className.indexOf(className) === -1) {
            element.className += " " + className;
        }
    }
}

function removeClass(element, className) {
    element.classList.remove(className);
}

function isDomEntity(entity) {
    return typeof entity === 'object' && entity.nodeType !== undefined;
}

// constants


const attrKeys = {
    id: "id",
    layout: "layout", //specifies the layout file to use with an `include` tag
    layout_width: "w",
    layout_height: "h",

    layout_maxWidth: "maxW",
    layout_maxHeight: "maxH",
    layout_minWidth: "minW",
    layout_minHeight: "minH",

    layout_margin: "m",
    layout_marginStart: "ms",
    layout_marginEnd: "me",
    layout_marginTop: "mt",
    layout_marginBottom: "mb",
    layout_marginHorizontal: "mh",
    layout_marginVertical: "mv",

    layout_constraintTop_toTopOf: "tt",
    layout_constraintBottom_toBottomOf: "bb",
    layout_constraintStart_toStartOf: "ss",
    layout_constraintEnd_toEndOf: "ee",
    layout_constraintTop_toBottomOf: "tb",
    layout_constraintStart_toEndOf: "se",
    layout_constraintEnd_toStartOf: "es",
    layout_constraintBottom_toTopOf: "bt",
    layout_constraintCenterXAlign: "cx",
    layout_constraintCenterYAlign: "cy",

    layout_constraintStart_toCenterX: "scx",
    layout_constraintCenterX_toStart: "cxs",
    layout_constraintEnd_toCenterX: "ecx",
    layout_constraintCenterX_toEnd: "cxe",

    layout_constraintTop_toCenterY: "tcy",
    layout_constraintCenterY_toTop: "cyt",
    layout_constraintBottom_toCenterY: "bcy",
    layout_constraintCenterY_toBottom: "cyb",

    layout_constraint: "data-const",
    layout_constraintGuide: "data-guide",
    layout_constraintGuideColor: "data-guide-color",
    layout_popup: "popup",//true or false..default on any element is false
    layout_src: "src",// fetch the sub-layout to include in a popup or an include from the path specified here.
    layout_constraintGuide_percent: "guide-pct",
    layout_constraintGuide_begin: "guide-begin",
    layout_constraintGuide_end: "guide-end",
    layout_horizontalBias: "hor-bias",// a floating point number between 0 and 1 specifying the priority of the horizontal constraint attributes
    layout_verticalBias: "ver-bias",// a floating point number between 0 and 1 specifying the priority of the vertical constraint attributes
    dimension_ratio: "dim-ratio",
    orientation: "orient",
};


const sizes = {
    MATCH_PARENT: 'match_parent',
    WRAP_CONTENT: 'wrap_content'
};

const orientations = {
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    GRID: 'grid'// Not available to all views
};

/**
 * Always sort the entries according to length, please!
 * @type {MM: string, PCT: string, VW: string, PT: string, IN: string, CH: string, VMAX: string, EM: string, PX: string, CM: string, Q: string, VH: string, PC: string, EX: string, VMIN: string, VM: string, REM: string, GD: string}
 */
const CssSizeUnits = {
    VMAX: "vmax",
    VMIN: "vmin",
    REM: "rem",

    EM: "em",
    PT: "pt",
    PX: "px",

    CM: "cm",
    IN: "in",
    MM: "mm",
    VM: "vm",
    VH: "vh",
    VW: "vw",
    PC: "pc",
    EX: "ex",
    CH: "ch",
    GD: "gd",
    PCT: "%",
    Q: "q"

};
const CssSizeUnitsValues = getObjectValues(CssSizeUnits).sort(function (a, b) {
    return b.length - a.length;
});


/**
 * A replacement for Object.values
 * @param obj An object
 * @return {*[]}
 */
function getObjectValues(obj) {
    var res = [];
    for (var i in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, i)) {
            res.push(obj[i]);
        }
    }
    return res;
}


//style.js by this author... gbenroscience

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 *
 * @param {string} attr The attribute
 * @param {string} value Its value
 * @returns {StyleElement}
 */
function StyleElement(attr, value) {
    if (typeof attr === 'string' && typeof value === 'string') {
        this.attr = attr.trim();
        this.value = value.trim();
    } else {
        throw new Error("attr or value must be string...`attr` = " + attr + ", `value` = " + value);
    }
}

StyleElement.prototype.setAttr = function (attr) {
    this.attr = attr;
};
StyleElement.prototype.getAttr = function () {
    return this.attr;
};
StyleElement.prototype.setValue = function (value) {
    this.value = value;
};
StyleElement.prototype.getValue = function () {
    return this.value;
};
StyleElement.prototype.getCss = function () {
    return this.attr + ":" + this.value + ";";
};


/**
 *
 * @param {string} name The name of the Style
 * @param {StyleElement[]} values An array of StyleElement values
 * @returns {Style}
 */
function Style(name, values) {
    if (!values) {
        values = [];
    }
    if (!isOneDimArray(values)) {
        throw new Error('One dimensional array of style elements expected');
    }
    this.name = name.trim();
    this.styleElements = values;
}

Style.prototype.setName = function (name) {
    this.name = name;
};
Style.prototype.getName = function () {
    return this.name;
};

Style.prototype.setStyleElements = function (styleElements) {
    this.styleElements = styleElements;
};
Style.prototype.getStyleElements = function () {
    return this.styleElements;
};
/**
 * Checks if the Style object contains any css styles.
 * @return {boolean}
 */
Style.prototype.isEmpty = function () {
    return this.styleElements.length === 0;
};


/**
 *  @param {string} entryName The class or  id or other selector name just the
 *  way it must appear in the stylesheet...e.g .cols or #values or table > tbody > tr > td > span
 * @returns {String} The pure css that can be injected directly
 * into a stylesheet
 */
Style.prototype.styleSheetEntry = function (entryName) {
    this.name = entryName;
    let styleBuffer = new StringBuffer();
    if (this.styleElements.length === 0) {
        return '';
    }
    styleBuffer.append(entryName).append(" { \n");
    for (let i = 0; i < this.styleElements.length; i++) {
        let styleObj = this.styleElements[i];
        styleBuffer.append(styleObj.getCss()).append("\n");
    }
    styleBuffer.append("} \n");
    return styleBuffer.toString();
};


Style.prototype.injectStyleSheet = function () {
    if (typeof this.name === 'undefined' || this.name === null || this.name === '') {
        throw 'Please define the name of this style!... e.g #name or .name';
    }
    let style = document.createElement('style');
    if (this.styleElements.length > 0) {
        style.setAttribute('type', 'text/css');
        style.innerHTML = this.styleSheetEntry(this.name);
        document.getElementsByTagName('head')[0].appendChild(style);
    }
};
/**
 * Converts a Style object to a generic Javascript/JSON object
 * @returns {Object}
 */
Style.prototype.toOptions = function () {
    let o = {};
    for (let i = 0; i < this.styleElements.length; i++) {
        let el = this.styleElements[i];
        let values = getObjectValues(el); //Object.values(el);
        o[values[0]] = values[1];
    }
    return o;
};

/**
 * @param htmlStyleElement An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param stylesArray An array of Style objects
 */
function injectStyleSheets(htmlStyleElement, stylesArray) {
    if (Object.prototype.toString.call(stylesArray) === '[object Array]') {
        let cssSheet = new StringBuffer('');
        cssSheet.append(htmlStyleElement.innerHTML);

        for (let i = 0; i < stylesArray.length; i++) {
            let style = stylesArray[i];
            if (style.constructor.name !== 'Style') {
                throw new Error('Please put only styles in the supplied array');
            }
            if (typeof style.name === 'undefined' || style.name === null || style.name === '') {
                throw 'Please define the name of this style!... e.g #name or .name';
            }
            cssSheet.append(style.styleSheetEntry(style.name));
            cssSheet.append('\n');
        }//end for loop
        htmlStyleElement.innerHTML = cssSheet.toString();
        document.getElementsByTagName('head')[0].appendChild(htmlStyleElement);
    } else {
        throw new Error("Please supply an array of styles");
    }
}

/**
 * Loads a stylesheet and checks if a name like the given style name already exists...e.g. #id or .kkk or table > tr > td.inner
 * If it does, it returns the index of the selector in the scanned stylesheet. Else it returns -1.
 * This index may make no meaning to the developer
 * except someone who knows how the Scanner method works.
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param selector A given selector.
 * @return The index of the selector in the scanned style sheet
 */
function indexOfSelector(htmlStyleElement, selector) {
    let css = htmlStyleElement.innerHTML;
    let scanner = new Scanner(css, true, ['{', '}']);
    let tokens = scanner.scan();
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '{') {
            if (i - 1 >= 0) {
                if (selector.trim() === tokens[i - 1].trim()) {
                    return i - 1;
                }
            }
        }
    }
    return -1;
}


/**
 * Loads a stylesheet and checks if a name like the given style name already exists...e.g. #id or .kkk or table > tr > td.inner
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param selector A given selector.
 */
function sheetContainsSelector(htmlStyleElement, selector) {
    let css = htmlStyleElement.innerHTML;
    return indexOfSelector(css, selector) !== -1;
}

/**
 * Parses a style sheet, and generates an array of styles
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @return {*[]} An array of Style objects
 */
function getAllStyles(htmlStyleElement) {
    let css = htmlStyleElement.innerHTML;
    let scanner = new Scanner(css, true, ['{', '}', ';']);
    let tokens = scanner.scan();

    /**
     * normalize data for input such as background-image: url(data:image/png;base64,iVBO...); which would have been split on the
     * ;base64 area which we do not intend, as our targets are the `;` that end each line of css style...e.g: width: 12px;
     *
     * The scanner would have split the `url(data:image/png;base64,iVBO...)` pattern into:
     *  [,..,'url(data:image/png' ,';', 'base64,iVBO',...), so 'weld' the disjoint together again, lol
     *
     *  NOTE:
     *  This occurs around the background-image property:
     *  background-image: url(data:[<mime type>][;charset=<charset>][;base64],<encoded data>)
     *
     */
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === ';') {
            if (i + 1 < tokens.length) {
                if (startsWith(tokens[i + 1], '\n') === false) {
                    //invalid split occurred. Please weld!
                    tokens[i - 1] = tokens[i - 1] + tokens[i] + tokens[i + 1];
                    //console.log('WELD-POINT:',tokens[i-1]);
                    tokens.splice(i, 1);
                    tokens.splice(i, 1);
                }
            }
        }
    }


    let styles = [];
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === '{') {
            if (i - 1 >= 0) {
                let selector = tokens[i - 1].trim();
                let currentStyle = new Style(selector, []);
                styles.push(currentStyle);
            }
        }
        if (tokens[i] === ';') {
            let currentStyle = styles[styles.length - 1];
            currentStyle.addStyleElementCss(tokens[i - 1] + ";");
        }
    }

    return styles;
}

/**
 * Looks through a css style sheet and returns a Style object that models the given selector if it exists in the
 * style sheet. Else it returns null;
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param selector A given style to fetch.
 */
function getStyle(htmlStyleElement, selector) {
    if (selector) {
        selector = selector.trim();
    } else {
        throw new Error('No selector supplied!');
    }
    let css = htmlStyleElement.innerHTML;
    let scanner = new Scanner(css, true, [selector, '{', '}', ';']);
    let tokens = scanner.scan();
    let buildingStyle = false;
    let currentStyle;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].trim() === selector) {
            if (i + 1 < tokens.length) {
                let j = i + 1;
                //check between selector and opening curly brace to be sure no strange non-whitespace token is there
                while (tokens[j] !== '{' && j < tokens.length) {
                    if (tokens[j].trim() !== '') {
                        throw new Error('Invalid token found in browser style sheet! File a bug report with browser manufacturer!! Description:\n\
                  No token like: ``' + tokens[j] + "`` should exist between ``" + selector + "`` and a ``{``");
                    }
                    j++;
                }
                currentStyle = new Style(selector, []);
                buildingStyle = true;
                i = j;
            }
        }
        if (buildingStyle === true) {
            if (tokens[i] === ';') {
                currentStyle.addStyleElementCss(tokens[i - 1] + ";");
            } else if (tokens[i] === '}') {
                return currentStyle;
            }
        }

    }

    return null;
}

/**
 * Edits the individual style-elements of a selector existing in a stylesheet already.
 * If it tries to edit a non-existent style, it will create a new style for it instead.
 * Checks if a style exists in the specified stylesheet, then applies the style elements in <code>newStyle</code>
 *  (e.g. width: 20px;) to it.
 *  If it already contains the specified elements, it updates their values to the ones specified in
 * <code>newStyle</code>
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param newStyle A given style.
 */
function editSelectorInStyleSheet(htmlStyleElement, newStyle) {
    if (newStyle.constructor.name === 'Style') {
        let selector = newStyle.name;
        let styles = getAllStyles(htmlStyleElement);
        let found = false;
        for (let i = 0; i < styles.length; i++) {
            let style = styles[i];
            if (style.name.trim() === selector) {
                found = true;
                for (let k = 0; k < newStyle.styleElements.length; k++) {
                    let elem = newStyle.styleElements[k];
                    style.addStyleElement(elem.attr, elem.value, false);
                }
                break;
            }
        }
        if (!found) {
            styles.push(newStyle);
        }

        htmlStyleElement.innerHTML = '';
        injectStyleSheets(htmlStyleElement, styles);
        return true;
    } else {
        throw new Error('Invalid style object supplied');
    }
}

/**
 * Adds a style to a stylesheet if it doesn't already exist in it. If it does exist in it, it updates it to the new one
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param newStyle A given style.
 */
function updateOrCreateSelectorInStyleSheet(htmlStyleElement, newStyle) {
    if (newStyle.constructor.name === 'Style') {
        let selector = newStyle.name;
        let styles = getAllStyles(htmlStyleElement);
        let found = false;
        for (let i = 0; i < styles.length; i++) {
            let style = styles[i];
            if (style.name.trim() === selector) {
                found = true;
                style.styleElements = newStyle.styleElements;
            }
        }
        if (!found) {
            styles.push(newStyle);
        }

        htmlStyleElement.innerHTML = '';
        injectStyleSheets(htmlStyleElement, styles);
        return true;
    } else {
        throw new Error('Invalid style object supplied');
    }
}


/**
 * Adds an array of styles to a stylesheet if it doesn't already exist in it. If it does exist in it, it updates it to the new one
 * @param htmlStyleElement  An html style element <<<htmlStyleElement = document.createElement('style');>>>
 * @param newStyles An array of styles.
 */
function updateOrCreateSelectorsInStyleSheet(htmlStyleElement, newStyles) {
    if (!isOneDimArray(newStyles)) {
        throw new Error('A one dimensional array expected for `newStyles`');
    }
    let styles = getAllStyles(htmlStyleElement);
    for (let i = 0; i < newStyles.length; i++) {
        let newStyle = newStyles[i];
        if (newStyle.constructor.name === 'Style') {
            let selector = newStyle.name;
            let found = false;
            for (let j = 0; j < styles.length; j++) {
                let style = styles[j];
                if (style.name.trim() === selector) {
                    found = true;
                    style.styleElements = newStyle.styleElements;//update
                }
            }
            if (!found) {
                styles.push(newStyle);// create if not found
            }
        } else {
            throw new Error('Invalid style object supplied');
        }
    }

    htmlStyleElement.innerHTML = '';
    injectStyleSheets(htmlStyleElement, styles);
}

/**
 *
 * @param {type} options A map of css keys and values, e.g.
 * {
 * width: "12em",
 * height: "100%",
 * color: "red",
 * border: "1px solid red"
 * }
 * @returns {undefined}
 */
Style.prototype.addFromOptions = function (options) {
    for (let key in options) {
        this.addStyleElement(key, options[key]);
    }
};
/**
 *
 * @returns {String} A css that can be injected as inline css on an html element.
 */
Style.prototype.getCss = function () {
    let styleBuffer = new StringBuffer();
    if (this.styleElements.length === 0) {
        return '';
    }
    styleBuffer.append(" style = \'");
    for (let i = 0; i < this.styleElements.length; i++) {
        let styleObj = this.styleElements[i];
        styleBuffer.append(styleObj.getCss());
    }
    styleBuffer.append("\' ");
    return styleBuffer.toString();
};
/**
 *
 * @returns {String} The pure css that can be injected directly
 * into a stylesheet, but without the id or class or the curly braces
 */
Style.prototype.rawCss = function () {
    let styleBuffer = new StringBuffer();
    if (this.styleElements.length === 0) {
        return '';
    }
    styleBuffer.append(" ");
    for (let i = 0; i < this.styleElements.length; i++) {
        let styleObj = this.styleElements[i];
        styleBuffer.append(styleObj.getCss());
    }
    styleBuffer.append(" ");
    return styleBuffer.toString();
};
/**
 * Applies this style as an inline style to the supplied element
 * @param {HTMLElement} elem
 */
Style.prototype.applyInline = function (elem) {
    if (elem) {
        if (isDomEntity(elem)) {
            for (let i = 0; i < this.styleElements.length; i++) {
                let stl = this.styleElements[i];
                elem.style[stl.attr] = stl.value;
            }
        } else {
            throw new Error("Invalid html element: " + elem);
        }
    } else {
        throw new Error("Please specify an html element.");
    }

};


/**
 *
 * @param {StyleElement} style The style object to remove
 * @returns {undefined}
 */
Style.prototype.removeStyleElementObj = function (style) {
    if (StyleElement.prototype.isPrototypeOf(style)) {
        let attr = style.getAttr();
        for (let index = 0; index < this.styleElements.length; index++) {
            let styl = this.styleElements[index];
            if (styl.getAttr() === attr) {
                this.styleElements.splice(index, 1);
                return;
            }
        }

    }
};
/**
 *
 * @param {string} styleAttr The attribute name of the StyleElement object to remove
 * @returns {undefined}
 */
Style.prototype.removeStyleElementByAttr = function (styleAttr) {
    for (let index = 0; index < this.styleElements.length; index++) {
        let styl = this.styleElements[index];
        if (styl.getAttr() === styleAttr) {
            this.styleElements.splice(index, 1);
            return;
        }
    }
};


/**
 *
 * @param {string} attr The attribute name of the StyleElement
 * @param {string} val The value of the style
 * @param {boolean} duplicateAllowed If true, a duplicate style element can be allowed in the style.
 * Due to the messed up nature of browsers, this is desirable at times: e.g..
 * li{
 * display: -moz-inline-stack;
 * display: inline-block;
 * }
 * If this parameter is not specified, then the method assumes no duplicate styles are allowed in a selector.
 * @returns {void}
 */
Style.prototype.addStyleElement = function (attr, val, duplicateAllowed) {
    if (duplicateAllowed) {
        this.styleElements.push(new StyleElement(attr, val));
    } else {
        for (let index = 0; index < this.styleElements.length; index++) {
            let styl = this.styleElements[index];
            if (styl.getAttr() === attr) { //attribute exists already..update and exit
                this.styleElements[index] = new StyleElement(attr, val);
                return;
            }
        }
        this.styleElements.push(new StyleElement(attr, val));
    }

};

/**
 *
 * Adds an array of style elements to this Style object.
 * @param {Array} styleElemsArray An array of StyleElement objects
 * @param {boolean} duplicateAllowed If true, a duplicate style element can be allowed in the style.
 * Due to the messed up nature of browsers, this is desirable at times: e.g..
 * li{
 * display: -moz-inline-stack;
 * display: inline-block;
 * }
 * If this parameter is not specified, then the method assumes no duplicate styles are allowed in a selector.
 * @returns {undefined}
 *
 */
Style.prototype.addStyleElementsArray = function (styleElemsArray, duplicateAllowed) {

    for (let index = 0; index < styleElemsArray.length; index++) {
        let styl = styleElemsArray[index];
        this.addStyleElementObj(styl, duplicateAllowed);
    }

};
/**
 *
 * @param {StyleElement} style The style element object
 * @param {boolean} duplicateAllowed If true, a duplicate style element can be allowed in the style.
 * Due to the messed up nature of browsers, this is desirable at times: e.g..
 * li{
 * display: -moz-inline-stack;
 * display: inline-block;
 * }
 * If this parameter is not specified, then the method assumes no duplicate styles are allowed in a selector.
 * @returns {undefined}
 */
Style.prototype.addStyleElementObj = function (style, duplicateAllowed) {


    if (StyleElement.prototype.isPrototypeOf(style)) {
        if (duplicateAllowed) {
            this.styleElements.push(style);
        } else {
            let attr = style.getAttr();
            for (let index = 0; index < this.styleElements.length; index++) {
                let styl = this.styleElements[index];
                if (styl.getAttr() === attr) {//attribute exists already..update and exit
                    this.styleElements[index] = style;
                    return;
                }
            }
            this.styleElements.push(style);
        }
    } else {
        throw new Error("Invalid Style specified.");
    }


};
/**
 * Creates a clone of this <code>Style</code>.
 * If the newName parameter is not supplied, then the name of the style is also cloned.
 * @param {string} newName
 * @returns {Style}
 */
Style.prototype.clone = function (newName) {
    let arr = [];

    for (let i = 0; i < this.styleElements.length; i++) {
        let elem = this.styleElements[i];
        arr.push(new StyleElement(elem.attr, elem.value));
    }
    /**
     * if no name|selector was supplied, the user wants to clone the name also.
     */
    if (!newName) {
        newName = this.name;
    }
    return new Style(newName, arr);
};
/**
 * The library handles all the details for you. The string MUST describe only 1 style element..e.g. width:10px;
 * @param {string} style The style string to add e.g. width:10;
 * @param {boolean} duplicateAllowed If true, a duplicate style element can be allowed in the style.
 * Due to the messed up nature of browsers, this is desirable at times: e.g..
 * li{
 * display: -moz-inline-stack;
 * display: inline-block;
 * }
 * If this parameter is not specified, then the method assumes no duplicate styles are allowed in a selector.
 * @returns {void}
 */
Style.prototype.addStyleElementCss = function (style, duplicateAllowed) {

    if (style) {
        style = style.trim();
        let styleHasUrl = contain(style, 'url') === true;
        let indexOfColon = style.indexOf(":");
        let indexOfSemiColon = styleHasUrl ? style.lastIndexOf(";") : style.indexOf(";");
        if (indexOfSemiColon !== -1 && indexOfSemiColon === style.length - 1 && indexOfColon !== -1) {

            let attr = style.substring(0, indexOfColon);
            let val = style.substring(indexOfColon + 1, indexOfSemiColon);

            if (attr.indexOf(":") === -1 && attr.indexOf(";") === -1 &&
                ((val.indexOf('url') === -1 && val.indexOf(":") === -1 && val.indexOf(";") === -1) ||
                    val.indexOf('url') !== '-1'/**Give more freedom, lol*/)) {
                let styleObj = new StyleElement(attr, val);
                if (duplicateAllowed) {
                    this.styleElements.push(styleObj);
                } else {
                    for (let index = 0; index < this.styleElements.length; index++) {
                        let styl = this.styleElements[index];
                        if (styl.getAttr() === attr) {//attribute exists already..update and exit
                            this.styleElements[index] = styleObj;
                            return;
                        }
                    }
                    this.styleElements.push(styleObj);
                }
            } else {
                throw new Error('Weird css line expression____!' + style);
            }
        } else {
            throw new Error('Invalid css line expression!...' + style);
        }

    } else {
        throw new Error('No css line supplied!');
    }
};

/**
 *
 * @param {string} attr The attribute name
 * @return {null|string} The value of the attribute in this style object.
 */
Style.prototype.getValue = function (attr) {

    for (let i = 0; i < this.styleElements.length; i++) {
        let elem = this.styleElements[i];
        if (elem.attr === attr) {
            return elem.value;
        }
    }

    return null;

};


/**
 * Credits to http://www.alexandre-gomes.com/?p=115
 * @return {number}
 */
function getScrollBarWidth() {
    let inner = document.createElement('p');
    inner.style.width = "100%";
    inner.style.height = "200px";

    let outer = document.createElement('div');
    outer.style.position = "absolute";
    outer.style.top = "0px";
    outer.style.left = "0px";
    outer.style.visibility = "hidden";
    outer.style.width = "200px";
    outer.style.height = "150px";
    outer.style.overflow = "hidden";
    outer.appendChild(inner);

    document.body.appendChild(outer);
    let w1 = inner.offsetWidth;
    outer.style.overflow = 'scroll';
    let w2 = inner.offsetWidth;
    if (w1 === w2) {
        w2 = outer.clientWidth;
    }

    document.body.removeChild(outer);

    return (w1 - w2);
}


/**
 * Parses a number and unit string into the number and the units.
 * @param val e.g 22px or 22%
 * @param {Boolean} seeNoUnitsAsPx If true, then if the supplied string is a number without units, the function
 * will assume that the units is in px. If false, it will assume it is a wrong input.
 * If either the number or the units is not a number or a unit, it returns null for both fields
 * @return the number and the units
 */
function parseNumberAndUnitsNoValidation(val, seeNoUnitsAsPx) {
    if (typeof val === 'number') {
        val = val + "";
    }
    if (typeof val !== "string") {
        return {number: null, units: null};
    }
    if (isNumber(val)) {
        if (seeNoUnitsAsPx && seeNoUnitsAsPx === true) {
            return {number: val, units: "px"};
        } else {
            return {number: null, units: null};
        }
    }

    let number = '';
    let i = val.length - 1;
    for (; i >= 0; i--) {
        let token = val.substring(i, i + 1);
        if (token !== '0' && token !== '1' && token !== '2' && token !== '3' && token !== '4' && token !== '5' &&
            token !== '6' && token !== '7' && token !== '8' && token !== '9') {
            // units = token + units;
        } else {
            number = val.substring(0, i + 1);
            break;
        }
    }
    let units = val.substring(i + 1);
    if (CssSizeUnitsValues.indexOf(units) === -1) {
        return {number: null, units: null};
    }
    if (!isNumber(number)) {
        return {number: null, units: null};
    }
    return {number: number, units: units};
}


function getUrls() {
    let scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        let script = scripts[i];
        let src = script.src;
        let ender = 'layman.js';
        let fullLen = src.length;
        let endLen = ender.length;
        //check if script.src ends with script file name
        if (src.lastIndexOf(ender) === fullLen - endLen) {
            scriptURL = src.substring(0, fullLen - endLen);

            //let projectURL = scriptsURL.substring(0, scriptsURL.length - "layit/".length);
            projectURL = scriptURL.substring(0, scriptURL.lastIndexOf("/", scriptURL.length - 2) + 1);
            return [projectURL, scriptURL];
        }
    }
    return null;
}


///////////////////////////////////////////////////////////////////////////////////////////////////

//Popup code
/**
 * Stores a reference to all popups here.
 * @type type
 */
var popupZIndex = 1000;


/**
 * A Popup object basically creates an overlay layout to
 * which predesigned html forms or other layout can be appended
 * quickly.
 * @param {type} options The options required to render the popup:
 * Format is:
 *
 *
  ```
 {
    id: "id",
    width : '10em',
    height : '6em',
    layout: '<div>...</div>',
    bg: '#ffffff',
    closeOnClickOutside: true|false,
    containerStyle: {
      width: 23%,
      border-radius : 1em,
      xxx: blah-blah-blah
    },
    onOpen : function(){},
    onClose : function(){}
  }
 ```
 *
 *
 *
 * @returns {undefined}
 */
function Popup(options) {

    if (!options) {
        throw new Error("No options specified for creating this popup");
    }
    if (!options.id || typeof options.id !== 'string') {
        throw new Error("Hi! You have not specified a value for options.layitId! Popup cannot be created");
    }
    this.id = options.id;

    if (typeof options.width !== 'string') {
        console.log("Hi! options.width must be a valid css dimension! Defaulting to 90%");
        options.width = "90%";
    }
    if (!options.width) {
        options.width = "90%";
    }

    if (typeof options.height !== 'string') {
        console.log("Hi! options.height must be a valid css dimension!  Defaulting to 90%");
        options.height = "90%";
    }
    if (!options.height) {
        options.height = "90%";
    }

    if (!options.bg || typeof options.bg !== 'string') {
        console.log("Hi! options.bg must be a valid html color!  defaulting to white");
        this.background = "#ffffff";
    } else {
        this.background = options.bg;
    }

    this.layout = '';

    if (typeof options.layout === 'string') {
        this.layout = options.layout;
    } else {
        throw new Error('Please supply the name of the xml layout');
    }
    this.closeOnClickOutside = true;
    if(typeof options.closeOnClickOutside === "boolean"){
        this.closeOnClickOutside = options.closeOnClickOutside;
    }


    if (options.onOpen && {}.toString.call(options.onOpen) === '[object Function]') {
        this.onOpen = options.onOpen;
    } else {
        this.onOpen = function () {
        };
    }


    if (options.onClose && {}.toString.call(options.onClose) === '[object Function]') {
        this.onClose = options.onClose;
    } else {
        this.onClose = function () {
        };
    }

    //this.injectableHTML = '<p style="padding: 1em;font-size: 1em; color : red;font-weight:bold">Home made OOP Popup!</p>';

    this.registry = {};//register css classes and map them to their styles.

    var body = document.body,
        html = document.documentElement;

    let bgWidth = Math.max(body.scrollWidth, body.offsetWidth,
        html.clientWidth, html.scrollWidth, html.offsetWidth);
    let bgHeight = Math.max(body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight);


    this.opaqueBgStyle = new Style('#' + this.overlayId(), []);
    this.containerStyle = new Style('#' + this.containerId(), []);

    this.noScrollStyle = new Style(".noscroll", []);
    this.closeBtnStyle = new Style("#" + this.closeBtnId(), []);

    popupZIndex += 10;
    this.opaqueBgStyle.addFromOptions({
        display: 'block',
        visibility: 'visible',
        opacity: '0.8',
        position: 'fixed',
        'background-color': "black",
        top: '0',
        left: '0',
        bottom: '0',
        right: '0',
        'z-index': popupZIndex + '',
        width: bgWidth + 'px',
        height: bgHeight + 'px'
    });
    this.noScrollStyle.addFromOptions({
        overflow: 'hidden'
    });

    this.width = options.width;
    this.height = options.height;

    var w = this.width;
    var h = this.height;
    var bg = this.background;


    {

        this.containerStyle.addFromOptions({
            position: 'absolute',
            'left': "calc(50% - " + w + " / 2 )",
            'top': "calc(50% - " + h + " / 2 )",
            visibility: 'visible',
            display: 'block',
            padding: '0px',
            margin: '0px',
            overflow: 'auto',
            width: w,
            height: h,
            'background-color': bg,
            'z-index': (popupZIndex + 1) + '',
            'border-radius': '0.3em'
        });

        if (typeof options["containerStyle"] === "object") {
            var containerCss = options.containerStyle;
            for (var key in containerCss) {
                this.containerStyle.addStyleElement(key, containerCss[key]);
            }
        }
    }

    {
        this.closeBtnStyle.addFromOptions({
            "top": "0.1em",
            "right": "0.1em",
            "position": "fixed",
            "font-size": "6rem",
            "font-weight": "bold",
            "font-family": "monospace",
            "cursor": "pointer",
            "color": "white",
            "background-color": "transparent",
            "border": "none",
            "padding": "none"
        });
    }

    this.registerStyle(this.opaqueBgStyle);
    this.registerStyle(this.containerStyle);
    this.registerStyle(this.closeBtnStyle);
    this.registerStyle(this.noScrollStyle);
}


Popup.prototype.registerStyle = function (style) {
    this.registry[style.name] = style;
};

Popup.prototype.hide = function () {
    var overlay = document.getElementById(this.overlayId());
    var dialog = document.getElementById(this.containerId());

    if (overlay) {
        overlay.style.display = 'none';
    }
    if (dialog) {
        dialog.style.display = 'none';
    }

    removeClass(document.body, this.noScrollStyle.name.substring(1));
    this.onClose();
    return this;
};

Popup.prototype.open = function () {
    this.build();
    return this;
};
Popup.prototype.build = function () {

    var popup = this;

    let freshCall = false;

    var overlay = document.getElementById(this.overlayId());
    var dialog = document.getElementById(this.containerId());

    if (!overlay) {
        freshCall = true;
        overlay = document.createElement('div');
        overlay.setAttribute("id", this.overlayId());
        addClass(overlay, this.overlayClass());
        document.body.appendChild(overlay);
    }

    overlay.style.display = 'block';
    overlay.onclick = function () {
        if(popup.closeOnClickOutside){
            popup.hide();
        }
    };


    if (dialog) {
        dialog.style.display = 'block';
    }else{
        dialog = document.createElement('div');
        dialog.setAttribute("id", this.containerId());
        addClass(dialog, this.containerClass());
        dialog.innerHTML = this.layout;
        document.body.appendChild(dialog);
    }


    let closeBtn = document.getElementById(this.closeBtnId());
    if (!closeBtn) {
        closeBtn = document.createElement("input");
        closeBtn.setAttribute("id", this.closeBtnId());
        addClass(closeBtn, this.closeBtnClass());
        closeBtn.type = "button";
        closeBtn.value = "\u02DF";
        overlay.appendChild(closeBtn);
    }

    closeBtn.onclick = function () {
        popup.hide();
    };


    if (freshCall) {
        var style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        var css = new StringBuffer();
        for (var key in this.registry) {
            css.append(this.registry[key].styleSheetEntry(key));
        }
        style.innerHTML = css.toString();
        document.getElementsByTagName('head')[0].appendChild(style);

        let p = new Page(dialog);
        p.layout();
        page.subPages.set(dialog.id, p);
    }

    addClass(document.body, this.noScrollStyle.name.substring(1));
    popup.onOpen();
    return this;
};


Popup.prototype.overlayId = function () {
    return this.id + "_main_overlay";
};


Popup.prototype.overlayClass = function () {
    return this.id + "_main_overlay_class";
};


Popup.prototype.containerId = function () {
    return this.id;
};


Popup.prototype.containerClass = function () {
    return this.id + "_container_class";
};


Popup.prototype.closeBtnClass = function () {
    return this.id + "_close_btn_class";
};

Popup.prototype.closeBtnId = function () {
    return this.id + "_close_btn_class";
};


//resize sensor js
'use strict';
// ResizeSensor.js from https://github.com/marcj/css-element-queries/
/**
 * @link https://github.com/marcj/css-element-queries/
 * Copyright Marc J. Schmidt. See the LICENSE file at the top-level
 * directory of this distribution and at
 * https://github.com/marcj/css-element-queries/blob/master/LICENSE.
 */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        root.ResizeSensor = factory();
    }
}(typeof window !== 'undefined' ? window : this, function () {

    // Make sure it does not throw in a SSR (Server Side Rendering) situation
    if (typeof window === "undefined") {
        return null;
    }
    // https://github.com/Semantic-Org/Semantic-UI/issues/3855
    // https://github.com/marcj/css-element-queries/issues/257
    var globalWindow = typeof window != 'undefined' && window.Math == Math
        ? window
        : typeof self != 'undefined' && self.Math == Math
            ? self
            : Function('return this')();
    // Only used for the dirty checking, so the event callback count is limited to max 1 call per fps per sensor.
    // In combination with the event based resize sensor this saves cpu time, because the sensor is too fast and
    // would generate too many unnecessary events.
    var requestAnimationFrame = globalWindow.requestAnimationFrame ||
        globalWindow.mozRequestAnimationFrame ||
        globalWindow.webkitRequestAnimationFrame ||
        function (fn) {
            return globalWindow.setTimeout(fn, 20);
        };

    var cancelAnimationFrame = globalWindow.cancelAnimationFrame ||
        globalWindow.mozCancelAnimationFrame ||
        globalWindow.webkitCancelAnimationFrame ||
        function (timer) {
            globalWindow.clearTimeout(timer);
        };

    /**
     * Iterate over each of the provided element(s).
     *
     * @param {HTMLElement|HTMLElement[]} elements
     * @param {Function}                  callback
     */
    function forEachElement(elements, callback) {
        var elementsType = Object.prototype.toString.call(elements);
        var isCollectionTyped = ('[object Array]' === elementsType
            || ('[object NodeList]' === elementsType)
            || ('[object HTMLCollection]' === elementsType)
            || ('[object Object]' === elementsType)
            || ('undefined' !== typeof jQuery && elements instanceof jQuery) //jquery
            || ('undefined' !== typeof Elements && elements instanceof Elements) //mootools
        );
        var i = 0, j = elements.length;
        if (isCollectionTyped) {
            for (; i < j; i++) {
                callback(elements[i]);
            }
        } else {
            callback(elements);
        }
    }

    /**
     * Get element size
     * @param {HTMLElement} element
     * @returns {Object} {width, height}
     */
    function getElementSize(element) {
        if (!element.getBoundingClientRect) {
            return {
                width: element.offsetWidth,
                height: element.offsetHeight
            };
        }

        var rect = element.getBoundingClientRect();
        return {
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        };
    }

    /**
     * Apply CSS styles to element.
     *
     * @param {HTMLElement} element
     * @param {Object} style
     */
    function setStyle(element, style) {
        Object.keys(style).forEach(function (key) {
            element.style[key] = style[key];
        });
    }

    /**
     * Class for dimension change detection.
     * @param {Element|Element[]|Elements|jQuery} element
     * @param {Function} callback
     *
     * @constructor
     */
    var ResizeSensor = function (element, callback) {
        //Is used when checking in reset() only for invisible elements
        var lastAnimationFrameForInvisibleCheck = 0;

        /**
         *
         * @constructor
         */
        function EventQueue() {
            var q = [];
            this.add = function (ev) {
                q.push(ev);
            };

            var i, j;
            this.call = function (sizeInfo) {
                for (i = 0, j = q.length; i < j; i++) {
                    q[i].call(this, sizeInfo);
                }
            };

            this.remove = function (ev) {
                var newQueue = [];
                for (i = 0, j = q.length; i < j; i++) {
                    if (q[i] !== ev) newQueue.push(q[i]);
                }
                q = newQueue;
            };

            this.length = function () {
                return q.length;
            };
        }

        /**
         *
         * @param {HTMLElement} element
         * @param {Function}    resized
         */
        function attachResizeEvent(element, resized) {
            if (!element) return;
            if (element.resizedAttached) {
                element.resizedAttached.add(resized);
                return;
            }

            element.resizedAttached = new EventQueue();
            element.resizedAttached.add(resized);

            element.resizeSensor = document.createElement('div');
            element.resizeSensor.dir = 'ltr';
            element.resizeSensor.className = 'resize-sensor';

            var style = {
                pointerEvents: 'none',
                position: 'absolute',
                left: '0px',
                top: '0px',
                right: '0px',
                bottom: '0px',
                overflow: 'hidden',
                zIndex: '-1',
                visibility: 'hidden',
                maxWidth: '100%'
            };
            var styleChild = {
                position: 'absolute',
                left: '0px',
                top: '0px',
                transition: '0s'
            };

            setStyle(element.resizeSensor, style);

            var expand = document.createElement('div');
            expand.className = 'resize-sensor-expand';
            setStyle(expand, style);

            var expandChild = document.createElement('div');
            setStyle(expandChild, styleChild);
            expand.appendChild(expandChild);

            var shrink = document.createElement('div');
            shrink.className = 'resize-sensor-shrink';
            setStyle(shrink, style);

            var shrinkChild = document.createElement('div');
            setStyle(shrinkChild, styleChild);
            setStyle(shrinkChild, {width: '200%', height: '200%'});
            shrink.appendChild(shrinkChild);

            element.resizeSensor.appendChild(expand);
            element.resizeSensor.appendChild(shrink);
            element.appendChild(element.resizeSensor);

            var computedStyle = window.getComputedStyle(element);
            var position = computedStyle ? computedStyle.getPropertyValue('position') : null;
            if ('absolute' !== position && 'relative' !== position && 'fixed' !== position && 'sticky' !== position) {
                element.style.position = 'relative';
            }

            var dirty = false;

            //last request animation frame id used in onscroll event
            var rafId = 0;
            var size = getElementSize(element);
            var lastWidth = 0;
            var lastHeight = 0;
            var initialHiddenCheck = true;
            lastAnimationFrameForInvisibleCheck = 0;

            var resetExpandShrink = function () {
                var width = element.offsetWidth;
                var height = element.offsetHeight;

                expandChild.style.width = (width + 10) + 'px';
                expandChild.style.height = (height + 10) + 'px';

                expand.scrollLeft = width + 10;
                expand.scrollTop = height + 10;

                shrink.scrollLeft = width + 10;
                shrink.scrollTop = height + 10;
            };

            var reset = function () {
                // Check if element is hidden
                if (initialHiddenCheck) {
                    var invisible = element.offsetWidth === 0 && element.offsetHeight === 0;
                    if (invisible) {
                        // Check in next frame
                        if (!lastAnimationFrameForInvisibleCheck) {
                            lastAnimationFrameForInvisibleCheck = requestAnimationFrame(function () {
                                lastAnimationFrameForInvisibleCheck = 0;
                                reset();
                            });
                        }

                        return;
                    } else {
                        // Stop checking
                        initialHiddenCheck = false;
                    }
                }

                resetExpandShrink();
            };
            element.resizeSensor.resetSensor = reset;

            var onResized = function () {
                rafId = 0;

                if (!dirty) return;

                lastWidth = size.width;
                lastHeight = size.height;

                if (element.resizedAttached) {
                    element.resizedAttached.call(size);
                }
            };

            var onScroll = function () {
                size = getElementSize(element);
                dirty = size.width !== lastWidth || size.height !== lastHeight;

                if (dirty && !rafId) {
                    rafId = requestAnimationFrame(onResized);
                }

                reset();
            };

            var addEvent = function (el, name, cb) {
                if (el.attachEvent) {
                    el.attachEvent('on' + name, cb);
                } else {
                    el.addEventListener(name, cb);
                }
            };

            addEvent(expand, 'scroll', onScroll);
            addEvent(shrink, 'scroll', onScroll);

            // Fix for custom Elements and invisible elements
            lastAnimationFrameForInvisibleCheck = requestAnimationFrame(function () {
                lastAnimationFrameForInvisibleCheck = 0;
                reset();
            });
        }

        forEachElement(element, function (elem) {
            attachResizeEvent(elem, callback);
        });

        this.detach = function (ev) {
            // clean up the unfinished animation frame to prevent a potential endless requestAnimationFrame of reset
            if (lastAnimationFrameForInvisibleCheck) {
                cancelAnimationFrame(lastAnimationFrameForInvisibleCheck);
                lastAnimationFrameForInvisibleCheck = 0;
            }
            ResizeSensor.detach(element, ev);
        };

        this.reset = function () {
            //To prevent invoking element.resizeSensor.resetSensor if it's undefined
            if (element.resizeSensor.resetSensor) {
                element.resizeSensor.resetSensor();
            }
        };
    };

    ResizeSensor.reset = function (element) {
        forEachElement(element, function (elem) {
            //To prevent invoking element.resizeSensor.resetSensor if it's undefined
            if (element.resizeSensor.resetSensor) {
                elem.resizeSensor.resetSensor();
            }
        });
    };

    ResizeSensor.detach = function (element, ev) {
        forEachElement(element, function (elem) {
            if (!elem) return;
            if (elem.resizedAttached && typeof ev === "function") {
                elem.resizedAttached.remove(ev);
                if (elem.resizedAttached.length()) return;
            }
            if (elem.resizeSensor) {
                if (elem.contains(elem.resizeSensor)) {
                    elem.removeChild(elem.resizeSensor);
                }
                delete elem.resizeSensor;
                delete elem.resizedAttached;
            }
        });
    };

    if (typeof MutationObserver !== "undefined") {
        var observer = new MutationObserver(function (mutations) {
            for (var i in mutations) {
                if (mutations.hasOwnProperty(i)) {
                    var items = mutations[i].addedNodes;
                    for (var j = 0; j < items.length; j++) {
                        if (items[j].resizeSensor) {
                            ResizeSensor.reset(items[j]);
                        }
                    }
                }
            }
        });

        document.addEventListener("DOMContentLoaded", function (event) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    return ResizeSensor;

}));


////////////////////// ULID/javascript
/**
 * @link https://github.com/ulid/javascript
 * @param {Object} global
 * @param {Object} factory
 * @returns {undefined}
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (factory((global.ULID = {})));
}(this, (function (exports) {
    'use strict';

    function createError(message) {
        var err = new Error(message);
        err.source = "ulid";
        return err;
    }

// These values should NEVER change. If
// they do, we're no longer making ulids!
    var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's Base32
    var ENCODING_LEN = ENCODING.length;
    var TIME_MAX = Math.pow(2, 48) - 1;
    var TIME_LEN = 10;
    var RANDOM_LEN = 16;

    function replaceCharAt(str, index, char) {
        if (index > str.length - 1) {
            return str;
        }
        return str.substr(0, index) + char + str.substr(index + 1);
    }

    function incrementBase32(str) {
        var done = undefined;
        var index = str.length;
        var char = void 0;
        var charIndex = void 0;
        var maxCharIndex = ENCODING_LEN - 1;
        while (!done && index-- >= 0) {
            char = str[index];
            charIndex = ENCODING.indexOf(char);
            if (charIndex === -1) {
                throw createError("incorrectly encoded string");
            }
            if (charIndex === maxCharIndex) {
                str = replaceCharAt(str, index, ENCODING[0]);
                continue;
            }
            done = replaceCharAt(str, index, ENCODING[charIndex + 1]);
        }
        if (typeof done === "string") {
            return done;
        }
        throw createError("cannot increment this string");
    }

    function randomChar(prng) {
        var rand = Math.floor(prng() * ENCODING_LEN);
        if (rand === ENCODING_LEN) {
            rand = ENCODING_LEN - 1;
        }
        return ENCODING.charAt(rand);
    }

    function encodeTime(now, len) {
        if (isNaN(now)) {
            throw new Error(now + " must be a number");
        }
        if (now > TIME_MAX) {
            throw createError("cannot encode time greater than " + TIME_MAX);
        }
        if (now < 0) {
            throw createError("time must be positive");
        }
        if (Number.isInteger(now) === false) {
            throw createError("time must be an integer");
        }
        var mod = void 0;
        var str = "";
        for (; len > 0; len--) {
            mod = now % ENCODING_LEN;
            str = ENCODING.charAt(mod) + str;
            now = (now - mod) / ENCODING_LEN;
        }
        return str;
    }

    function encodeRandom(len, prng) {
        var str = "";
        for (; len > 0; len--) {
            str = randomChar(prng) + str;
        }
        return str;
    }

    function decodeTime(id) {
        if (id.length !== TIME_LEN + RANDOM_LEN) {
            throw createError("malformed ulid");
        }
        var time = id.substr(0, TIME_LEN).split("").reverse().reduce(function (carry, char, index) {
            var encodingIndex = ENCODING.indexOf(char);
            if (encodingIndex === -1) {
                throw createError("invalid character found: " + char);
            }
            return carry += encodingIndex * Math.pow(ENCODING_LEN, index);
        }, 0);
        if (time > TIME_MAX) {
            throw createError("malformed ulid, timestamp too large");
        }
        return time;
    }

    function detectPrng() {
        var allowInsecure = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
        var root = arguments[1];

        if (!root) {
            root = typeof window !== "undefined" ? window : null;
        }
        var browserCrypto = root && (root.crypto || root.msCrypto);
        if (browserCrypto) {
            return function () {
                var buffer = new Uint8Array(1);
                browserCrypto.getRandomValues(buffer);
                return buffer[0] / 0xff;
            };
        } else {
            try {
                var nodeCrypto = require("crypto");
                return function () {
                    return nodeCrypto.randomBytes(1).readUInt8() / 0xff;
                };
            } catch (e) {
            }
        }
        if (allowInsecure) {
            try {
                console.error("secure crypto unusable, falling back to insecure Math.random()!");
            } catch (e) {
            }
            return function () {
                return Math.random();
            };
        }
        throw createError("secure crypto unusable, insecure Math.random not allowed");
    }

    function factory(currPrng) {
        if (!currPrng) {
            currPrng = detectPrng();
        }
        return function ulid(seedTime) {
            if (isNaN(seedTime)) {
                seedTime = Date.now();
            }
            return encodeTime(seedTime, TIME_LEN) + encodeRandom(RANDOM_LEN, currPrng);
        };
    }

    function monotonicFactory(currPrng) {
        if (!currPrng) {
            currPrng = detectPrng();
        }
        var lastTime = 0;
        var lastRandom = void 0;
        return function ulid(seedTime) {
            if (isNaN(seedTime)) {
                seedTime = Date.now();
            }
            if (seedTime <= lastTime) {
                var incrementedRandom = lastRandom = incrementBase32(lastRandom);
                return encodeTime(lastTime, TIME_LEN) + incrementedRandom;
            }
            lastTime = seedTime;
            var newRandom = lastRandom = encodeRandom(RANDOM_LEN, currPrng);
            return encodeTime(seedTime, TIME_LEN) + newRandom;
        };
    }

    var ulid = factory();

    exports.replaceCharAt = replaceCharAt;
    exports.incrementBase32 = incrementBase32;
    exports.randomChar = randomChar;
    exports.encodeTime = encodeTime;
    exports.encodeRandom = encodeRandom;
    exports.decodeTime = decodeTime;
    exports.detectPrng = detectPrng;
    exports.factory = factory;
    exports.monotonicFactory = monotonicFactory;
    exports.ulid = ulid;

    Object.defineProperty(exports, '__esModule', {value: true});

})));

/**
 * AutoLayout.js is licensed under the MIT license. If a copy of the
 * MIT-license was not distributed with this file, You can obtain one at:
 * http://opensource.org/licenses/mit-license.html.
 * @link https://github.com/lume/autolayout
 *
 * @author: Hein Rutjes (IjzerenHein)
 * @license MIT
 * @copyright Gloey Apps, 2017
 *
 * @library autolayout.js
 * @version 0.7.0
 */
/**
 * Parts Copyright (C) 2011-2012, Alex Russell (slightlyoff@chromium.org)
 * Parts Copyright (C) Copyright (C) 1998-2000 Greg J. Badros
 *
 * Use of this source code is governed by the LGPL, which can be found in the
 * COPYING.LGPL file.
 */
(function (f) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = f()
    } else if (typeof define === "function" && define.amd) {
        define([], f)
    } else {
        var g;
        if (typeof window !== "undefined") {
            g = window
        } else if (typeof global !== "undefined") {
            g = global
        } else if (typeof self !== "undefined") {
            g = self
        } else {
            g = this
        }
        g.AutoLayout = f()
    }
})(function () {
    var define, module, exports;
    return (function e(t, n, r) {
        function s(o, u) {
            if (!n[o]) {
                if (!t[o]) {
                    var a = typeof require == "function" && require;
                    if (!u && a) return a(o, !0);
                    if (i) return i(o, !0);
                    var f = new Error("Cannot find module '" + o + "'");
                    throw f.code = "MODULE_NOT_FOUND", f
                }
                var l = n[o] = {exports: {}};
                t[o][0].call(l.exports, function (e) {
                    var n = t[o][1][e];
                    return s(n ? n : e)
                }, l, l.exports, e, t, n, r)
            }
            return n[o].exports
        }

        var i = typeof require == "function" && require;
        for (var o = 0; o < r.length; o++) s(r[o]);
        return s
    })({
        1: [function (require, module, exports) {
            'use strict';

            var _createClass = function () {
                function defineProperties(target, props) {
                    for (var i = 0; i < props.length; i++) {
                        var descriptor = props[i];
                        descriptor.enumerable = descriptor.enumerable || false;
                        descriptor.configurable = true;
                        if ("value" in descriptor) descriptor.writable = true;
                        Object.defineProperty(target, descriptor.key, descriptor);
                    }
                }

                return function (Constructor, protoProps, staticProps) {
                    if (protoProps) defineProperties(Constructor.prototype, protoProps);
                    if (staticProps) defineProperties(Constructor, staticProps);
                    return Constructor;
                };
            }();

            function _classCallCheck(instance, Constructor) {
                if (!(instance instanceof Constructor)) {
                    throw new TypeError("Cannot call a class as a function");
                }
            }

            var c = require('cassowary/bin/c');
            'use strict';

            /**
             * Layout attributes.
             * @enum {String}
             */
            var Attribute = {
                CONST: 'const',
                NOTANATTRIBUTE: 'const',
                VARIABLE: 'var',
                LEFT: 'left',
                RIGHT: 'right',
                TOP: 'top',
                BOTTOM: 'bottom',
                WIDTH: 'width',
                HEIGHT: 'height',
                CENTERX: 'centerX',
                CENTERY: 'centerY',
                /*LEADING: 'leading',
  TRAILING: 'trailing'*/
                /** Used by the extended VFL syntax. */
                ZINDEX: 'zIndex'
            };

            /**
             * Relation types.
             * @enum {String}
             */
            var Relation = {
                /** Less than or equal */
                LEQ: 'leq',
                /** Equal */
                EQU: 'equ',
                /** Greater than or equal */
                GEQ: 'geq'
            };

            /**
             * Layout priorities.
             * @enum {String}
             */
            var Priority = {
                REQUIRED: 1000,
                DEFAULTHIGH: 750,
                DEFAULTLOW: 250
                //FITTINGSIZELEVEL: 50,
            };

            var parser = function () {
                /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

                function peg$subclass(child, parent) {
                    function ctor() {
                        this.constructor = child;
                    }

                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor();
                }

                function SyntaxError(message, expected, found, offset, line, column) {
                    this.message = message;
                    this.expected = expected;
                    this.found = found;
                    this.offset = offset;
                    this.line = line;
                    this.column = column;

                    this.name = "SyntaxError";
                }

                peg$subclass(SyntaxError, Error);

                function parse(input) {
                    var options = arguments.length > 1 ? arguments[1] : {},
                        peg$FAILED = {},
                        peg$startRuleFunctions = {visualFormatString: peg$parsevisualFormatString},
                        peg$startRuleFunction = peg$parsevisualFormatString,
                        peg$c0 = peg$FAILED,
                        peg$c1 = null,
                        peg$c2 = ":",
                        peg$c3 = {type: "literal", value: ":", description: "\":\""},
                        peg$c4 = [],
                        peg$c5 = function peg$c5(o, superto, view, views, tosuper) {
                            return {
                                orientation: o ? o[0] : 'horizontal',
                                cascade: (superto || []).concat([view], [].concat.apply([], views), tosuper || [])
                            };
                        },
                        peg$c6 = "H",
                        peg$c7 = {type: "literal", value: "H", description: "\"H\""},
                        peg$c8 = "V",
                        peg$c9 = {type: "literal", value: "V", description: "\"V\""},
                        peg$c10 = function peg$c10(orient) {
                            return orient == 'H' ? 'horizontal' : 'vertical';
                        },
                        peg$c11 = "|",
                        peg$c12 = {type: "literal", value: "|", description: "\"|\""},
                        peg$c13 = function peg$c13() {
                            return {view: null};
                        },
                        peg$c14 = "[",
                        peg$c15 = {type: "literal", value: "[", description: "\"[\""},
                        peg$c16 = "]",
                        peg$c17 = {type: "literal", value: "]", description: "\"]\""},
                        peg$c18 = function peg$c18(view, predicates) {
                            return extend(view, predicates ? {constraints: predicates} : {});
                        },
                        peg$c19 = "-",
                        peg$c20 = {type: "literal", value: "-", description: "\"-\""},
                        peg$c21 = function peg$c21(predicateList) {
                            return predicateList;
                        },
                        peg$c22 = function peg$c22() {
                            return [{relation: 'equ', constant: 'default', $parserOffset: offset()}];
                        },
                        peg$c23 = "",
                        peg$c24 = function peg$c24() {
                            return [{relation: 'equ', constant: 0, $parserOffset: offset()}];
                        },
                        peg$c25 = function peg$c25(n) {
                            return [{relation: 'equ', constant: n, $parserOffset: offset()}];
                        },
                        peg$c26 = "(",
                        peg$c27 = {type: "literal", value: "(", description: "\"(\""},
                        peg$c28 = ",",
                        peg$c29 = {type: "literal", value: ",", description: "\",\""},
                        peg$c30 = ")",
                        peg$c31 = {type: "literal", value: ")", description: "\")\""},
                        peg$c32 = function peg$c32(p, ps) {
                            return [p].concat(ps.map(function (p) {
                                return p[1];
                            }));
                        },
                        peg$c33 = "@",
                        peg$c34 = {type: "literal", value: "@", description: "\"@\""},
                        peg$c35 = function peg$c35(r, o, p) {
                            return extend({relation: 'equ'}, r || {}, o, p ? p[1] : {});
                        },
                        peg$c36 = "==",
                        peg$c37 = {type: "literal", value: "==", description: "\"==\""},
                        peg$c38 = function peg$c38() {
                            return {relation: 'equ', $parserOffset: offset()};
                        },
                        peg$c39 = "<=",
                        peg$c40 = {type: "literal", value: "<=", description: "\"<=\""},
                        peg$c41 = function peg$c41() {
                            return {relation: 'leq', $parserOffset: offset()};
                        },
                        peg$c42 = ">=",
                        peg$c43 = {type: "literal", value: ">=", description: "\">=\""},
                        peg$c44 = function peg$c44() {
                            return {relation: 'geq', $parserOffset: offset()};
                        },
                        peg$c45 = /^[0-9]/,
                        peg$c46 = {type: "class", value: "[0-9]", description: "[0-9]"},
                        peg$c47 = function peg$c47(digits) {
                            return {priority: parseInt(digits.join(""), 10)};
                        },
                        peg$c48 = function peg$c48(n) {
                            return {constant: n};
                        },
                        peg$c49 = /^[a-zA-Z_]/,
                        peg$c50 = {type: "class", value: "[a-zA-Z_]", description: "[a-zA-Z_]"},
                        peg$c51 = /^[a-zA-Z0-9_]/,
                        peg$c52 = {type: "class", value: "[a-zA-Z0-9_]", description: "[a-zA-Z0-9_]"},
                        peg$c53 = function peg$c53(f, v) {
                            return {view: f + v};
                        },
                        peg$c54 = ".",
                        peg$c55 = {type: "literal", value: ".", description: "\".\""},
                        peg$c56 = function peg$c56(digits, decimals) {
                            return parseFloat(digits.concat(".").concat(decimals).join(""), 10);
                        },
                        peg$c57 = function peg$c57(digits) {
                            return parseInt(digits.join(""), 10);
                        },
                        peg$currPos = 0,
                        peg$reportedPos = 0,
                        peg$cachedPos = 0,
                        peg$cachedPosDetails = {line: 1, column: 1, seenCR: false},
                        peg$maxFailPos = 0,
                        peg$maxFailExpected = [],
                        peg$silentFails = 0,
                        peg$result;

                    if ("startRule" in options) {
                        if (!(options.startRule in peg$startRuleFunctions)) {
                            throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
                        }

                        peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
                    }

                    function text() {
                        return input.substring(peg$reportedPos, peg$currPos);
                    }

                    function offset() {
                        return peg$reportedPos;
                    }

                    function line() {
                        return peg$computePosDetails(peg$reportedPos).line;
                    }

                    function column() {
                        return peg$computePosDetails(peg$reportedPos).column;
                    }

                    function expected(description) {
                        throw peg$buildException(null, [{type: "other", description: description}], peg$reportedPos);
                    }

                    function error(message) {
                        throw peg$buildException(message, null, peg$reportedPos);
                    }

                    function peg$computePosDetails(pos) {
                        function advance(details, startPos, endPos) {
                            var p, ch;

                            for (p = startPos; p < endPos; p++) {
                                ch = input.charAt(p);
                                if (ch === "\n") {
                                    if (!details.seenCR) {
                                        details.line++;
                                    }
                                    details.column = 1;
                                    details.seenCR = false;
                                } else if (ch === "\r" || ch === '\u2028' || ch === '\u2029') {
                                    details.line++;
                                    details.column = 1;
                                    details.seenCR = true;
                                } else {
                                    details.column++;
                                    details.seenCR = false;
                                }
                            }
                        }

                        if (peg$cachedPos !== pos) {
                            if (peg$cachedPos > pos) {
                                peg$cachedPos = 0;
                                peg$cachedPosDetails = {line: 1, column: 1, seenCR: false};
                            }
                            advance(peg$cachedPosDetails, peg$cachedPos, pos);
                            peg$cachedPos = pos;
                        }

                        return peg$cachedPosDetails;
                    }

                    function peg$fail(expected) {
                        if (peg$currPos < peg$maxFailPos) {
                            return;
                        }

                        if (peg$currPos > peg$maxFailPos) {
                            peg$maxFailPos = peg$currPos;
                            peg$maxFailExpected = [];
                        }

                        peg$maxFailExpected.push(expected);
                    }

                    function peg$buildException(message, expected, pos) {
                        function cleanupExpected(expected) {
                            var i = 1;

                            expected.sort(function (a, b) {
                                if (a.description < b.description) {
                                    return -1;
                                } else if (a.description > b.description) {
                                    return 1;
                                } else {
                                    return 0;
                                }
                            });

                            while (i < expected.length) {
                                if (expected[i - 1] === expected[i]) {
                                    expected.splice(i, 1);
                                } else {
                                    i++;
                                }
                            }
                        }

                        function buildMessage(expected, found) {
                            function stringEscape(s) {
                                function hex(ch) {
                                    return ch.charCodeAt(0).toString(16).toUpperCase();
                                }

                                return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\x08/g, '\\b').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\f/g, '\\f').replace(/\r/g, '\\r').replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
                                    return '\\x0' + hex(ch);
                                }).replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
                                    return '\\x' + hex(ch);
                                }).replace(/[\u0180-\u0FFF]/g, function (ch) {
                                    return '\\u0' + hex(ch);
                                }).replace(/[\u1080-\uFFFF]/g, function (ch) {
                                    return '\\u' + hex(ch);
                                });
                            }

                            var expectedDescs = new Array(expected.length),
                                expectedDesc,
                                foundDesc,
                                i;

                            for (i = 0; i < expected.length; i++) {
                                expectedDescs[i] = expected[i].description;
                            }

                            expectedDesc = expected.length > 1 ? expectedDescs.slice(0, -1).join(", ") + " or " + expectedDescs[expected.length - 1] : expectedDescs[0];

                            foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

                            return "Expected " + expectedDesc + " but " + foundDesc + " found.";
                        }

                        var posDetails = peg$computePosDetails(pos),
                            found = pos < input.length ? input.charAt(pos) : null;

                        if (expected !== null) {
                            cleanupExpected(expected);
                        }

                        return new SyntaxError(message !== null ? message : buildMessage(expected, found), expected, found, pos, posDetails.line, posDetails.column);
                    }

                    function peg$parsevisualFormatString() {
                        var s0, s1, s2, s3, s4, s5, s6, s7;

                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = peg$parseorientation();
                        if (s2 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 58) {
                                s3 = peg$c2;
                                peg$currPos++;
                            } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c3);
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s2 = [s2, s3];
                                s1 = s2;
                            } else {
                                peg$currPos = s1;
                                s1 = peg$c0;
                            }
                        } else {
                            peg$currPos = s1;
                            s1 = peg$c0;
                        }
                        if (s1 === peg$FAILED) {
                            s1 = peg$c1;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsesuperview();
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parseconnection();
                                if (s4 !== peg$FAILED) {
                                    s3 = [s3, s4];
                                    s2 = s3;
                                } else {
                                    peg$currPos = s2;
                                    s2 = peg$c0;
                                }
                            } else {
                                peg$currPos = s2;
                                s2 = peg$c0;
                            }
                            if (s2 === peg$FAILED) {
                                s2 = peg$c1;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parseview();
                                if (s3 !== peg$FAILED) {
                                    s4 = [];
                                    s5 = peg$currPos;
                                    s6 = peg$parseconnection();
                                    if (s6 !== peg$FAILED) {
                                        s7 = peg$parseview();
                                        if (s7 !== peg$FAILED) {
                                            s6 = [s6, s7];
                                            s5 = s6;
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s5;
                                        s5 = peg$c0;
                                    }
                                    while (s5 !== peg$FAILED) {
                                        s4.push(s5);
                                        s5 = peg$currPos;
                                        s6 = peg$parseconnection();
                                        if (s6 !== peg$FAILED) {
                                            s7 = peg$parseview();
                                            if (s7 !== peg$FAILED) {
                                                s6 = [s6, s7];
                                                s5 = s6;
                                            } else {
                                                peg$currPos = s5;
                                                s5 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$currPos;
                                        s6 = peg$parseconnection();
                                        if (s6 !== peg$FAILED) {
                                            s7 = peg$parsesuperview();
                                            if (s7 !== peg$FAILED) {
                                                s6 = [s6, s7];
                                                s5 = s6;
                                            } else {
                                                peg$currPos = s5;
                                                s5 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                        if (s5 === peg$FAILED) {
                                            s5 = peg$c1;
                                        }
                                        if (s5 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c5(s1, s2, s3, s4, s5);
                                            s0 = s1;
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseorientation() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 72) {
                            s1 = peg$c6;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c7);
                            }
                        }
                        if (s1 === peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 86) {
                                s1 = peg$c8;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c9);
                                }
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c10(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parsesuperview() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 124) {
                            s1 = peg$c11;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c12);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c13();
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parseview() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 91) {
                            s1 = peg$c14;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c15);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseviewName();
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsepredicateListWithParens();
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c1;
                                }
                                if (s3 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 93) {
                                        s4 = peg$c16;
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c17);
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c18(s2, s3);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseconnection() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 45) {
                            s1 = peg$c19;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c20);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsepredicateList();
                            if (s2 !== peg$FAILED) {
                                if (input.charCodeAt(peg$currPos) === 45) {
                                    s3 = peg$c19;
                                    peg$currPos++;
                                } else {
                                    s3 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c20);
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c21(s2);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 45) {
                                s1 = peg$c19;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c20);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c22();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                s1 = peg$c23;
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c24();
                                }
                                s0 = s1;
                            }
                        }

                        return s0;
                    }

                    function peg$parsepredicateList() {
                        var s0;

                        s0 = peg$parsesimplePredicate();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parsepredicateListWithParens();
                        }

                        return s0;
                    }

                    function peg$parsesimplePredicate() {
                        var s0, s1;

                        s0 = peg$currPos;
                        s1 = peg$parsenumber();
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c25(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parsepredicateListWithParens() {
                        var s0, s1, s2, s3, s4, s5, s6;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 40) {
                            s1 = peg$c26;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c27);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsepredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 44) {
                                    s5 = peg$c28;
                                    peg$currPos++;
                                } else {
                                    s5 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c29);
                                    }
                                }
                                if (s5 !== peg$FAILED) {
                                    s6 = peg$parsepredicate();
                                    if (s6 !== peg$FAILED) {
                                        s5 = [s5, s6];
                                        s4 = s5;
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s4;
                                    s4 = peg$c0;
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 44) {
                                        s5 = peg$c28;
                                        peg$currPos++;
                                    } else {
                                        s5 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c29);
                                        }
                                    }
                                    if (s5 !== peg$FAILED) {
                                        s6 = peg$parsepredicate();
                                        if (s6 !== peg$FAILED) {
                                            s5 = [s5, s6];
                                            s4 = s5;
                                        } else {
                                            peg$currPos = s4;
                                            s4 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 41) {
                                        s4 = peg$c30;
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c31);
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c32(s2, s3);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsepredicate() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        s1 = peg$parserelation();
                        if (s1 === peg$FAILED) {
                            s1 = peg$c1;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseobjectOfPredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 64) {
                                    s4 = peg$c33;
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c34);
                                    }
                                }
                                if (s4 !== peg$FAILED) {
                                    s5 = peg$parsepriority();
                                    if (s5 !== peg$FAILED) {
                                        s4 = [s4, s5];
                                        s3 = s4;
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$c0;
                                }
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c1;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c35(s1, s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parserelation() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c36) {
                            s1 = peg$c36;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c37);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c38();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.substr(peg$currPos, 2) === peg$c39) {
                                s1 = peg$c39;
                                peg$currPos += 2;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c40);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c41();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.substr(peg$currPos, 2) === peg$c42) {
                                    s1 = peg$c42;
                                    peg$currPos += 2;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c43);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c44();
                                }
                                s0 = s1;
                            }
                        }

                        return s0;
                    }

                    function peg$parseobjectOfPredicate() {
                        var s0;

                        s0 = peg$parseconstant();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parseviewName();
                        }

                        return s0;
                    }

                    function peg$parsepriority() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = [];
                        if (peg$c45.test(input.charAt(peg$currPos))) {
                            s2 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c46);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                if (peg$c45.test(input.charAt(peg$currPos))) {
                                    s2 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c46);
                                    }
                                }
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c47(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parseconstant() {
                        var s0, s1;

                        s0 = peg$currPos;
                        s1 = peg$parsenumber();
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c48(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parseviewName() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = [];
                        if (peg$c49.test(input.charAt(peg$currPos))) {
                            s3 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c50);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                if (peg$c49.test(input.charAt(peg$currPos))) {
                                    s3 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s3 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c50);
                                    }
                                }
                            }
                        } else {
                            s2 = peg$c0;
                        }
                        if (s2 !== peg$FAILED) {
                            s2 = input.substring(s1, peg$currPos);
                        }
                        s1 = s2;
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            if (peg$c51.test(input.charAt(peg$currPos))) {
                                s4 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s4 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c52);
                                }
                            }
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                if (peg$c51.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c52);
                                    }
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s3 = input.substring(s2, peg$currPos);
                            }
                            s2 = s3;
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c53(s1, s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsenumber() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = [];
                        if (peg$c45.test(input.charAt(peg$currPos))) {
                            s2 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c46);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                if (peg$c45.test(input.charAt(peg$currPos))) {
                                    s2 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c46);
                                    }
                                }
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 46) {
                                s2 = peg$c54;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c55);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                if (peg$c45.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c46);
                                    }
                                }
                                if (s4 !== peg$FAILED) {
                                    while (s4 !== peg$FAILED) {
                                        s3.push(s4);
                                        if (peg$c45.test(input.charAt(peg$currPos))) {
                                            s4 = input.charAt(peg$currPos);
                                            peg$currPos++;
                                        } else {
                                            s4 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c46);
                                            }
                                        }
                                    }
                                } else {
                                    s3 = peg$c0;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c56(s1, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = [];
                            if (peg$c45.test(input.charAt(peg$currPos))) {
                                s2 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c46);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                while (s2 !== peg$FAILED) {
                                    s1.push(s2);
                                    if (peg$c45.test(input.charAt(peg$currPos))) {
                                        s2 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s2 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c46);
                                        }
                                    }
                                }
                            } else {
                                s1 = peg$c0;
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c57(s1);
                            }
                            s0 = s1;
                        }

                        return s0;
                    }

                    function extend(dst) {
                        for (var i = 1; i < arguments.length; i++) {
                            for (var k in arguments[i]) {
                                dst[k] = arguments[i][k];
                            }
                        }
                        return dst;
                    }

                    peg$result = peg$startRuleFunction();

                    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
                        return peg$result;
                    } else {
                        if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                            peg$fail({type: "end", description: "end of input"});
                        }

                        throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
                    }
                }

                return {
                    SyntaxError: SyntaxError,
                    parse: parse
                };
            }();

            var parserExt = function () {
                /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

                function peg$subclass(child, parent) {
                    function ctor() {
                        this.constructor = child;
                    }

                    ctor.prototype = parent.prototype;
                    child.prototype = new ctor();
                }

                function SyntaxError(message, expected, found, offset, line, column) {
                    this.message = message;
                    this.expected = expected;
                    this.found = found;
                    this.offset = offset;
                    this.line = line;
                    this.column = column;

                    this.name = "SyntaxError";
                }

                peg$subclass(SyntaxError, Error);

                function parse(input) {
                    var options = arguments.length > 1 ? arguments[1] : {},
                        peg$FAILED = {},
                        peg$startRuleFunctions = {visualFormatStringExt: peg$parsevisualFormatStringExt},
                        peg$startRuleFunction = peg$parsevisualFormatStringExt,
                        peg$c0 = peg$FAILED,
                        peg$c1 = "C:",
                        peg$c2 = {type: "literal", value: "C:", description: "\"C:\""},
                        peg$c3 = [],
                        peg$c4 = null,
                        peg$c5 = function peg$c5(view, attribute, attributes, comments) {
                            return {
                                type: 'attribute',
                                view: view.view,
                                attributes: [attribute].concat(attributes)
                            };
                        },
                        peg$c6 = function peg$c6(attr, predicates) {
                            return {attr: attr, predicates: predicates};
                        },
                        peg$c7 = ":",
                        peg$c8 = {type: "literal", value: ":", description: "\":\""},
                        peg$c9 = function peg$c9(o, superto, view, views, tosuper, comments) {
                            return {
                                type: 'vfl',
                                orientation: o ? o[0] : 'horizontal',
                                cascade: (superto || []).concat(view, [].concat.apply([], views), tosuper || [])
                            };
                        },
                        peg$c10 = "HV",
                        peg$c11 = {type: "literal", value: "HV", description: "\"HV\""},
                        peg$c12 = function peg$c12() {
                            return 'horzvert';
                        },
                        peg$c13 = "H",
                        peg$c14 = {type: "literal", value: "H", description: "\"H\""},
                        peg$c15 = function peg$c15() {
                            return 'horizontal';
                        },
                        peg$c16 = "V",
                        peg$c17 = {type: "literal", value: "V", description: "\"V\""},
                        peg$c18 = function peg$c18() {
                            return 'vertical';
                        },
                        peg$c19 = "Z",
                        peg$c20 = {type: "literal", value: "Z", description: "\"Z\""},
                        peg$c21 = function peg$c21() {
                            return 'zIndex';
                        },
                        peg$c22 = " ",
                        peg$c23 = {type: "literal", value: " ", description: "\" \""},
                        peg$c24 = "//",
                        peg$c25 = {type: "literal", value: "//", description: "\"//\""},
                        peg$c26 = {type: "any", description: "any character"},
                        peg$c27 = "|",
                        peg$c28 = {type: "literal", value: "|", description: "\"|\""},
                        peg$c29 = function peg$c29() {
                            return {view: null};
                        },
                        peg$c30 = "[",
                        peg$c31 = {type: "literal", value: "[", description: "\"[\""},
                        peg$c32 = ",",
                        peg$c33 = {type: "literal", value: ",", description: "\",\""},
                        peg$c34 = "]",
                        peg$c35 = {type: "literal", value: "]", description: "\"]\""},
                        peg$c36 = function peg$c36(view, views) {
                            return views.length ? [view].concat([].concat.apply([], views)) : view;
                        },
                        peg$c37 = function peg$c37(view, predicates, cascadedViews) {
                            return extend(extend(view, predicates ? {constraints: predicates} : {}), cascadedViews ? {
                                cascade: cascadedViews
                            } : {});
                        },
                        peg$c38 = function peg$c38(views, connection) {
                            return [].concat([].concat.apply([], views), [connection]);
                        },
                        peg$c39 = "->",
                        peg$c40 = {type: "literal", value: "->", description: "\"->\""},
                        peg$c41 = function peg$c41() {
                            return [{relation: 'none'}];
                        },
                        peg$c42 = "-",
                        peg$c43 = {type: "literal", value: "-", description: "\"-\""},
                        peg$c44 = function peg$c44(predicateList) {
                            return predicateList;
                        },
                        peg$c45 = function peg$c45() {
                            return [{relation: 'equ', constant: 'default'}];
                        },
                        peg$c46 = "~",
                        peg$c47 = {type: "literal", value: "~", description: "\"~\""},
                        peg$c48 = function peg$c48() {
                            return [{relation: 'equ', equalSpacing: true}];
                        },
                        peg$c49 = "",
                        peg$c50 = function peg$c50() {
                            return [{relation: 'equ', constant: 0}];
                        },
                        peg$c51 = function peg$c51(p) {
                            return [{relation: 'equ', multiplier: p.multiplier}];
                        },
                        peg$c52 = function peg$c52(n) {
                            return [{relation: 'equ', constant: n}];
                        },
                        peg$c53 = "(",
                        peg$c54 = {type: "literal", value: "(", description: "\"(\""},
                        peg$c55 = ")",
                        peg$c56 = {type: "literal", value: ")", description: "\")\""},
                        peg$c57 = function peg$c57(p, ps) {
                            return [p].concat(ps.map(function (p) {
                                return p[1];
                            }));
                        },
                        peg$c58 = "@",
                        peg$c59 = {type: "literal", value: "@", description: "\"@\""},
                        peg$c60 = function peg$c60(r, o, p) {
                            return extend({relation: 'equ'}, r || {}, o, p ? p[1] : {});
                        },
                        peg$c61 = function peg$c61(r, o, p) {
                            return extend({relation: 'equ', equalSpacing: true}, r || {}, o, p ? p[1] : {});
                        },
                        peg$c62 = "==",
                        peg$c63 = {type: "literal", value: "==", description: "\"==\""},
                        peg$c64 = function peg$c64() {
                            return {relation: 'equ'};
                        },
                        peg$c65 = "<=",
                        peg$c66 = {type: "literal", value: "<=", description: "\"<=\""},
                        peg$c67 = function peg$c67() {
                            return {relation: 'leq'};
                        },
                        peg$c68 = ">=",
                        peg$c69 = {type: "literal", value: ">=", description: "\">=\""},
                        peg$c70 = function peg$c70() {
                            return {relation: 'geq'};
                        },
                        peg$c71 = /^[0-9]/,
                        peg$c72 = {type: "class", value: "[0-9]", description: "[0-9]"},
                        peg$c73 = function peg$c73(digits) {
                            return {priority: parseInt(digits.join(""), 10)};
                        },
                        peg$c74 = function peg$c74(n) {
                            return {constant: n};
                        },
                        peg$c75 = function peg$c75(n) {
                            return {constant: -n};
                        },
                        peg$c76 = "+",
                        peg$c77 = {type: "literal", value: "+", description: "\"+\""},
                        peg$c78 = "%",
                        peg$c79 = {type: "literal", value: "%", description: "\"%\""},
                        peg$c80 = function peg$c80(n) {
                            return {view: null, multiplier: n / 100};
                        },
                        peg$c81 = function peg$c81(n) {
                            return {view: null, multiplier: n / -100};
                        },
                        peg$c82 = function peg$c82(vn, a, m, c) {
                            return {
                                view: vn.view,
                                attribute: a ? a : undefined,
                                multiplier: m ? m : 1,
                                constant: c ? c : undefined
                            };
                        },
                        peg$c83 = ".left",
                        peg$c84 = {type: "literal", value: ".left", description: "\".left\""},
                        peg$c85 = function peg$c85() {
                            return 'left';
                        },
                        peg$c86 = ".right",
                        peg$c87 = {type: "literal", value: ".right", description: "\".right\""},
                        peg$c88 = function peg$c88() {
                            return 'right';
                        },
                        peg$c89 = ".top",
                        peg$c90 = {type: "literal", value: ".top", description: "\".top\""},
                        peg$c91 = function peg$c91() {
                            return 'top';
                        },
                        peg$c92 = ".bottom",
                        peg$c93 = {type: "literal", value: ".bottom", description: "\".bottom\""},
                        peg$c94 = function peg$c94() {
                            return 'bottom';
                        },
                        peg$c95 = ".width",
                        peg$c96 = {type: "literal", value: ".width", description: "\".width\""},
                        peg$c97 = function peg$c97() {
                            return 'width';
                        },
                        peg$c98 = ".height",
                        peg$c99 = {type: "literal", value: ".height", description: "\".height\""},
                        peg$c100 = function peg$c100() {
                            return 'height';
                        },
                        peg$c101 = ".centerX",
                        peg$c102 = {type: "literal", value: ".centerX", description: "\".centerX\""},
                        peg$c103 = function peg$c103() {
                            return 'centerX';
                        },
                        peg$c104 = ".centerY",
                        peg$c105 = {type: "literal", value: ".centerY", description: "\".centerY\""},
                        peg$c106 = function peg$c106() {
                            return 'centerY';
                        },
                        peg$c107 = "/",
                        peg$c108 = {type: "literal", value: "/", description: "\"/\""},
                        peg$c109 = function peg$c109(n) {
                            return 1 / n;
                        },
                        peg$c110 = "/+",
                        peg$c111 = {type: "literal", value: "/+", description: "\"/+\""},
                        peg$c112 = "/-",
                        peg$c113 = {type: "literal", value: "/-", description: "\"/-\""},
                        peg$c114 = function peg$c114(n) {
                            return -1 / n;
                        },
                        peg$c115 = "*",
                        peg$c116 = {type: "literal", value: "*", description: "\"*\""},
                        peg$c117 = function peg$c117(n) {
                            return n;
                        },
                        peg$c118 = "*+",
                        peg$c119 = {type: "literal", value: "*+", description: "\"*+\""},
                        peg$c120 = "*-",
                        peg$c121 = {type: "literal", value: "*-", description: "\"*-\""},
                        peg$c122 = function peg$c122(n) {
                            return -n;
                        },
                        peg$c123 = /^[a-zA-Z_]/,
                        peg$c124 = {type: "class", value: "[a-zA-Z_]", description: "[a-zA-Z_]"},
                        peg$c125 = /^[a-zA-Z0-9_]/,
                        peg$c126 = {type: "class", value: "[a-zA-Z0-9_]", description: "[a-zA-Z0-9_]"},
                        peg$c127 = function peg$c127(f, v, r) {
                            return {view: f + v, range: r, $parserOffset: offset()};
                        },
                        peg$c128 = function peg$c128(f, v) {
                            return {view: f + v, $parserOffset: offset()};
                        },
                        peg$c129 = "..",
                        peg$c130 = {type: "literal", value: "..", description: "\"..\""},
                        peg$c131 = function peg$c131(d) {
                            return parseInt(d);
                        },
                        peg$c132 = ".",
                        peg$c133 = {type: "literal", value: ".", description: "\".\""},
                        peg$c134 = function peg$c134(digits, decimals) {
                            return parseFloat(digits.concat(".").concat(decimals).join(""), 10);
                        },
                        peg$c135 = function peg$c135(digits) {
                            return parseInt(digits.join(""), 10);
                        },
                        peg$currPos = 0,
                        peg$reportedPos = 0,
                        peg$cachedPos = 0,
                        peg$cachedPosDetails = {line: 1, column: 1, seenCR: false},
                        peg$maxFailPos = 0,
                        peg$maxFailExpected = [],
                        peg$silentFails = 0,
                        peg$result;

                    if ("startRule" in options) {
                        if (!(options.startRule in peg$startRuleFunctions)) {
                            throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
                        }

                        peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
                    }

                    function text() {
                        return input.substring(peg$reportedPos, peg$currPos);
                    }

                    function offset() {
                        return peg$reportedPos;
                    }

                    function line() {
                        return peg$computePosDetails(peg$reportedPos).line;
                    }

                    function column() {
                        return peg$computePosDetails(peg$reportedPos).column;
                    }

                    function expected(description) {
                        throw peg$buildException(null, [{type: "other", description: description}], peg$reportedPos);
                    }

                    function error(message) {
                        throw peg$buildException(message, null, peg$reportedPos);
                    }

                    function peg$computePosDetails(pos) {
                        function advance(details, startPos, endPos) {
                            var p, ch;

                            for (p = startPos; p < endPos; p++) {
                                ch = input.charAt(p);
                                if (ch === "\n") {
                                    if (!details.seenCR) {
                                        details.line++;
                                    }
                                    details.column = 1;
                                    details.seenCR = false;
                                } else if (ch === "\r" || ch === '\u2028' || ch === '\u2029') {
                                    details.line++;
                                    details.column = 1;
                                    details.seenCR = true;
                                } else {
                                    details.column++;
                                    details.seenCR = false;
                                }
                            }
                        }

                        if (peg$cachedPos !== pos) {
                            if (peg$cachedPos > pos) {
                                peg$cachedPos = 0;
                                peg$cachedPosDetails = {line: 1, column: 1, seenCR: false};
                            }
                            advance(peg$cachedPosDetails, peg$cachedPos, pos);
                            peg$cachedPos = pos;
                        }

                        return peg$cachedPosDetails;
                    }

                    function peg$fail(expected) {
                        if (peg$currPos < peg$maxFailPos) {
                            return;
                        }

                        if (peg$currPos > peg$maxFailPos) {
                            peg$maxFailPos = peg$currPos;
                            peg$maxFailExpected = [];
                        }

                        peg$maxFailExpected.push(expected);
                    }

                    function peg$buildException(message, expected, pos) {
                        function cleanupExpected(expected) {
                            var i = 1;

                            expected.sort(function (a, b) {
                                if (a.description < b.description) {
                                    return -1;
                                } else if (a.description > b.description) {
                                    return 1;
                                } else {
                                    return 0;
                                }
                            });

                            while (i < expected.length) {
                                if (expected[i - 1] === expected[i]) {
                                    expected.splice(i, 1);
                                } else {
                                    i++;
                                }
                            }
                        }

                        function buildMessage(expected, found) {
                            function stringEscape(s) {
                                function hex(ch) {
                                    return ch.charCodeAt(0).toString(16).toUpperCase();
                                }

                                return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\x08/g, '\\b').replace(/\t/g, '\\t').replace(/\n/g, '\\n').replace(/\f/g, '\\f').replace(/\r/g, '\\r').replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
                                    return '\\x0' + hex(ch);
                                }).replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
                                    return '\\x' + hex(ch);
                                }).replace(/[\u0180-\u0FFF]/g, function (ch) {
                                    return '\\u0' + hex(ch);
                                }).replace(/[\u1080-\uFFFF]/g, function (ch) {
                                    return '\\u' + hex(ch);
                                });
                            }

                            var expectedDescs = new Array(expected.length),
                                expectedDesc,
                                foundDesc,
                                i;

                            for (i = 0; i < expected.length; i++) {
                                expectedDescs[i] = expected[i].description;
                            }

                            expectedDesc = expected.length > 1 ? expectedDescs.slice(0, -1).join(", ") + " or " + expectedDescs[expected.length - 1] : expectedDescs[0];

                            foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

                            return "Expected " + expectedDesc + " but " + foundDesc + " found.";
                        }

                        var posDetails = peg$computePosDetails(pos),
                            found = pos < input.length ? input.charAt(pos) : null;

                        if (expected !== null) {
                            cleanupExpected(expected);
                        }

                        return new SyntaxError(message !== null ? message : buildMessage(expected, found), expected, found, pos, posDetails.line, posDetails.column);
                    }

                    function peg$parsevisualFormatStringExt() {
                        var s0;

                        s0 = peg$parsevisualFormatString();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parsevisualFormatStringConstraintExpression();
                        }

                        return s0;
                    }

                    function peg$parsevisualFormatStringConstraintExpression() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c1) {
                            s1 = peg$c1;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c2);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseviewName();
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parseattributePredicate();
                                if (s3 !== peg$FAILED) {
                                    s4 = [];
                                    s5 = peg$parseattributePredicate();
                                    while (s5 !== peg$FAILED) {
                                        s4.push(s5);
                                        s5 = peg$parseattributePredicate();
                                    }
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$parsecomments();
                                        if (s5 === peg$FAILED) {
                                            s5 = peg$c4;
                                        }
                                        if (s5 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c5(s2, s3, s4, s5);
                                            s0 = s1;
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseattributePredicate() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = peg$parseattribute();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsepredicateListWithParens();
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c6(s1, s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsevisualFormatString() {
                        var s0, s1, s2, s3, s4, s5, s6, s7;

                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = peg$parseorientation();
                        if (s2 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 58) {
                                s3 = peg$c7;
                                peg$currPos++;
                            } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c8);
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s2 = [s2, s3];
                                s1 = s2;
                            } else {
                                peg$currPos = s1;
                                s1 = peg$c0;
                            }
                        } else {
                            peg$currPos = s1;
                            s1 = peg$c0;
                        }
                        if (s1 === peg$FAILED) {
                            s1 = peg$c4;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsesuperview();
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parseconnection();
                                if (s4 !== peg$FAILED) {
                                    s3 = [s3, s4];
                                    s2 = s3;
                                } else {
                                    peg$currPos = s2;
                                    s2 = peg$c0;
                                }
                            } else {
                                peg$currPos = s2;
                                s2 = peg$c0;
                            }
                            if (s2 === peg$FAILED) {
                                s2 = peg$c4;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parseviewGroup();
                                if (s3 !== peg$FAILED) {
                                    s4 = [];
                                    s5 = peg$currPos;
                                    s6 = peg$parseconnection();
                                    if (s6 !== peg$FAILED) {
                                        s7 = peg$parseviewGroup();
                                        if (s7 !== peg$FAILED) {
                                            s6 = [s6, s7];
                                            s5 = s6;
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s5;
                                        s5 = peg$c0;
                                    }
                                    while (s5 !== peg$FAILED) {
                                        s4.push(s5);
                                        s5 = peg$currPos;
                                        s6 = peg$parseconnection();
                                        if (s6 !== peg$FAILED) {
                                            s7 = peg$parseviewGroup();
                                            if (s7 !== peg$FAILED) {
                                                s6 = [s6, s7];
                                                s5 = s6;
                                            } else {
                                                peg$currPos = s5;
                                                s5 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$currPos;
                                        s6 = peg$parseconnection();
                                        if (s6 !== peg$FAILED) {
                                            s7 = peg$parsesuperview();
                                            if (s7 !== peg$FAILED) {
                                                s6 = [s6, s7];
                                                s5 = s6;
                                            } else {
                                                peg$currPos = s5;
                                                s5 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s5;
                                            s5 = peg$c0;
                                        }
                                        if (s5 === peg$FAILED) {
                                            s5 = peg$c4;
                                        }
                                        if (s5 !== peg$FAILED) {
                                            s6 = peg$parsecomments();
                                            if (s6 === peg$FAILED) {
                                                s6 = peg$c4;
                                            }
                                            if (s6 !== peg$FAILED) {
                                                peg$reportedPos = s0;
                                                s1 = peg$c9(s1, s2, s3, s4, s5, s6);
                                                s0 = s1;
                                            } else {
                                                peg$currPos = s0;
                                                s0 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseorientation() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c10) {
                            s1 = peg$c10;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c11);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c12();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 72) {
                                s1 = peg$c13;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c14);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c15();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 86) {
                                    s1 = peg$c16;
                                    peg$currPos++;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c17);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c18();
                                }
                                s0 = s1;
                                if (s0 === peg$FAILED) {
                                    s0 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 90) {
                                        s1 = peg$c19;
                                        peg$currPos++;
                                    } else {
                                        s1 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c20);
                                        }
                                    }
                                    if (s1 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c21();
                                    }
                                    s0 = s1;
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsecomments() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = [];
                        if (input.charCodeAt(peg$currPos) === 32) {
                            s2 = peg$c22;
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c23);
                            }
                        }
                        while (s2 !== peg$FAILED) {
                            s1.push(s2);
                            if (input.charCodeAt(peg$currPos) === 32) {
                                s2 = peg$c22;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c23);
                                }
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            if (input.substr(peg$currPos, 2) === peg$c24) {
                                s2 = peg$c24;
                                peg$currPos += 2;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c25);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                if (input.length > peg$currPos) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c26);
                                    }
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    if (input.length > peg$currPos) {
                                        s4 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c26);
                                        }
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    s1 = [s1, s2, s3];
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsesuperview() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 124) {
                            s1 = peg$c27;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c28);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c29();
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parseviewGroup() {
                        var s0, s1, s2, s3, s4, s5, s6;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 91) {
                            s1 = peg$c30;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c31);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseview();
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 44) {
                                    s5 = peg$c32;
                                    peg$currPos++;
                                } else {
                                    s5 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c33);
                                    }
                                }
                                if (s5 !== peg$FAILED) {
                                    s6 = peg$parseview();
                                    if (s6 !== peg$FAILED) {
                                        s5 = [s5, s6];
                                        s4 = s5;
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s4;
                                    s4 = peg$c0;
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 44) {
                                        s5 = peg$c32;
                                        peg$currPos++;
                                    } else {
                                        s5 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c33);
                                        }
                                    }
                                    if (s5 !== peg$FAILED) {
                                        s6 = peg$parseview();
                                        if (s6 !== peg$FAILED) {
                                            s5 = [s5, s6];
                                            s4 = s5;
                                        } else {
                                            peg$currPos = s4;
                                            s4 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 93) {
                                        s4 = peg$c34;
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c35);
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c36(s2, s3);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseview() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parseviewNameRange();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsepredicateListWithParens();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c4;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecascadedViews();
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c4;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c37(s1, s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsecascadedViews() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 58) {
                            s1 = peg$c7;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c8);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$currPos;
                            s4 = peg$parseconnection();
                            if (s4 !== peg$FAILED) {
                                s5 = peg$parseviewGroup();
                                if (s5 !== peg$FAILED) {
                                    s4 = [s4, s5];
                                    s3 = s4;
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$c0;
                                }
                            } else {
                                peg$currPos = s3;
                                s3 = peg$c0;
                            }
                            if (s3 !== peg$FAILED) {
                                while (s3 !== peg$FAILED) {
                                    s2.push(s3);
                                    s3 = peg$currPos;
                                    s4 = peg$parseconnection();
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$parseviewGroup();
                                        if (s5 !== peg$FAILED) {
                                            s4 = [s4, s5];
                                            s3 = s4;
                                        } else {
                                            peg$currPos = s3;
                                            s3 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$c0;
                                    }
                                }
                            } else {
                                s2 = peg$c0;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parseconnection();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c38(s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseconnection() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c39) {
                            s1 = peg$c39;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c40);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c41();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 45) {
                                s1 = peg$c42;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c43);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsepredicateList();
                                if (s2 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 45) {
                                        s3 = peg$c42;
                                        peg$currPos++;
                                    } else {
                                        s3 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c43);
                                        }
                                    }
                                    if (s3 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c44(s2);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 45) {
                                    s1 = peg$c42;
                                    peg$currPos++;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c43);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c45();
                                }
                                s0 = s1;
                                if (s0 === peg$FAILED) {
                                    s0 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 126) {
                                        s1 = peg$c46;
                                        peg$currPos++;
                                    } else {
                                        s1 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c47);
                                        }
                                    }
                                    if (s1 !== peg$FAILED) {
                                        s2 = peg$parseequalSpacingPredicateList();
                                        if (s2 !== peg$FAILED) {
                                            if (input.charCodeAt(peg$currPos) === 126) {
                                                s3 = peg$c46;
                                                peg$currPos++;
                                            } else {
                                                s3 = peg$FAILED;
                                                if (peg$silentFails === 0) {
                                                    peg$fail(peg$c47);
                                                }
                                            }
                                            if (s3 !== peg$FAILED) {
                                                peg$reportedPos = s0;
                                                s1 = peg$c44(s2);
                                                s0 = s1;
                                            } else {
                                                peg$currPos = s0;
                                                s0 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                    if (s0 === peg$FAILED) {
                                        s0 = peg$currPos;
                                        if (input.charCodeAt(peg$currPos) === 126) {
                                            s1 = peg$c46;
                                            peg$currPos++;
                                        } else {
                                            s1 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c47);
                                            }
                                        }
                                        if (s1 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c48();
                                        }
                                        s0 = s1;
                                        if (s0 === peg$FAILED) {
                                            s0 = peg$currPos;
                                            s1 = peg$c49;
                                            if (s1 !== peg$FAILED) {
                                                peg$reportedPos = s0;
                                                s1 = peg$c50();
                                            }
                                            s0 = s1;
                                        }
                                    }
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsepredicateList() {
                        var s0;

                        s0 = peg$parsesimplePredicate();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parsepredicateListWithParens();
                        }

                        return s0;
                    }

                    function peg$parsesimplePredicate() {
                        var s0, s1;

                        s0 = peg$currPos;
                        s1 = peg$parsepercentage();
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c51(s1);
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$parsenumber();
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c52(s1);
                            }
                            s0 = s1;
                        }

                        return s0;
                    }

                    function peg$parsepredicateListWithParens() {
                        var s0, s1, s2, s3, s4, s5, s6;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 40) {
                            s1 = peg$c53;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c54);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsepredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 44) {
                                    s5 = peg$c32;
                                    peg$currPos++;
                                } else {
                                    s5 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c33);
                                    }
                                }
                                if (s5 !== peg$FAILED) {
                                    s6 = peg$parsepredicate();
                                    if (s6 !== peg$FAILED) {
                                        s5 = [s5, s6];
                                        s4 = s5;
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s4;
                                    s4 = peg$c0;
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 44) {
                                        s5 = peg$c32;
                                        peg$currPos++;
                                    } else {
                                        s5 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c33);
                                        }
                                    }
                                    if (s5 !== peg$FAILED) {
                                        s6 = peg$parsepredicate();
                                        if (s6 !== peg$FAILED) {
                                            s5 = [s5, s6];
                                            s4 = s5;
                                        } else {
                                            peg$currPos = s4;
                                            s4 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 41) {
                                        s4 = peg$c55;
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c56);
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c57(s2, s3);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsepredicate() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        s1 = peg$parserelation();
                        if (s1 === peg$FAILED) {
                            s1 = peg$c4;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseobjectOfPredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 64) {
                                    s4 = peg$c58;
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c59);
                                    }
                                }
                                if (s4 !== peg$FAILED) {
                                    s5 = peg$parsepriority();
                                    if (s5 !== peg$FAILED) {
                                        s4 = [s4, s5];
                                        s3 = s4;
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$c0;
                                }
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c4;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c60(s1, s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseequalSpacingPredicateList() {
                        var s0, s1, s2, s3, s4, s5, s6;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 40) {
                            s1 = peg$c53;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c54);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseequalSpacingPredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 44) {
                                    s5 = peg$c32;
                                    peg$currPos++;
                                } else {
                                    s5 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c33);
                                    }
                                }
                                if (s5 !== peg$FAILED) {
                                    s6 = peg$parseequalSpacingPredicate();
                                    if (s6 !== peg$FAILED) {
                                        s5 = [s5, s6];
                                        s4 = s5;
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s4;
                                    s4 = peg$c0;
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 44) {
                                        s5 = peg$c32;
                                        peg$currPos++;
                                    } else {
                                        s5 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c33);
                                        }
                                    }
                                    if (s5 !== peg$FAILED) {
                                        s6 = peg$parseequalSpacingPredicate();
                                        if (s6 !== peg$FAILED) {
                                            s5 = [s5, s6];
                                            s4 = s5;
                                        } else {
                                            peg$currPos = s4;
                                            s4 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s4;
                                        s4 = peg$c0;
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 41) {
                                        s4 = peg$c55;
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c56);
                                        }
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c57(s2, s3);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseequalSpacingPredicate() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        s1 = peg$parserelation();
                        if (s1 === peg$FAILED) {
                            s1 = peg$c4;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseobjectOfPredicate();
                            if (s2 !== peg$FAILED) {
                                s3 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 64) {
                                    s4 = peg$c58;
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c59);
                                    }
                                }
                                if (s4 !== peg$FAILED) {
                                    s5 = peg$parsepriority();
                                    if (s5 !== peg$FAILED) {
                                        s4 = [s4, s5];
                                        s3 = s4;
                                    } else {
                                        peg$currPos = s3;
                                        s3 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s3;
                                    s3 = peg$c0;
                                }
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c4;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c61(s1, s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parserelation() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c62) {
                            s1 = peg$c62;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c63);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c64();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.substr(peg$currPos, 2) === peg$c65) {
                                s1 = peg$c65;
                                peg$currPos += 2;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c66);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c67();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.substr(peg$currPos, 2) === peg$c68) {
                                    s1 = peg$c68;
                                    peg$currPos += 2;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c69);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c70();
                                }
                                s0 = s1;
                            }
                        }

                        return s0;
                    }

                    function peg$parseobjectOfPredicate() {
                        var s0;

                        s0 = peg$parsepercentage();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parseconstant();
                            if (s0 === peg$FAILED) {
                                s0 = peg$parseviewPredicate();
                            }
                        }

                        return s0;
                    }

                    function peg$parsepriority() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = [];
                        if (peg$c71.test(input.charAt(peg$currPos))) {
                            s2 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c72);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                if (peg$c71.test(input.charAt(peg$currPos))) {
                                    s2 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c72);
                                    }
                                }
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c73(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parseconstant() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = peg$parsenumber();
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c74(s1);
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 45) {
                                s1 = peg$c42;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c43);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsenumber();
                                if (s2 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c75(s2);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 43) {
                                    s1 = peg$c76;
                                    peg$currPos++;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c77);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    s2 = peg$parsenumber();
                                    if (s2 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c74(s2);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsepercentage() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parsenumber();
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 37) {
                                s2 = peg$c78;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c79);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c80(s1);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 45) {
                                s1 = peg$c42;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c43);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsenumber();
                                if (s2 !== peg$FAILED) {
                                    if (input.charCodeAt(peg$currPos) === 37) {
                                        s3 = peg$c78;
                                        peg$currPos++;
                                    } else {
                                        s3 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c79);
                                        }
                                    }
                                    if (s3 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c81(s2);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.charCodeAt(peg$currPos) === 43) {
                                    s1 = peg$c76;
                                    peg$currPos++;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c77);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    s2 = peg$parsenumber();
                                    if (s2 !== peg$FAILED) {
                                        if (input.charCodeAt(peg$currPos) === 37) {
                                            s3 = peg$c78;
                                            peg$currPos++;
                                        } else {
                                            s3 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c79);
                                            }
                                        }
                                        if (s3 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c80(s2);
                                            s0 = s1;
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parseviewPredicate() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parseviewName();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseattribute();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c4;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsemultiplier();
                                if (s3 === peg$FAILED) {
                                    s3 = peg$c4;
                                }
                                if (s3 !== peg$FAILED) {
                                    s4 = peg$parseconstantExpr();
                                    if (s4 === peg$FAILED) {
                                        s4 = peg$c4;
                                    }
                                    if (s4 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c82(s1, s2, s3, s4);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parseattribute() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 5) === peg$c83) {
                            s1 = peg$c83;
                            peg$currPos += 5;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c84);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c85();
                        }
                        s0 = s1;
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.substr(peg$currPos, 6) === peg$c86) {
                                s1 = peg$c86;
                                peg$currPos += 6;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c87);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c88();
                            }
                            s0 = s1;
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.substr(peg$currPos, 4) === peg$c89) {
                                    s1 = peg$c89;
                                    peg$currPos += 4;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c90);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c91();
                                }
                                s0 = s1;
                                if (s0 === peg$FAILED) {
                                    s0 = peg$currPos;
                                    if (input.substr(peg$currPos, 7) === peg$c92) {
                                        s1 = peg$c92;
                                        peg$currPos += 7;
                                    } else {
                                        s1 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c93);
                                        }
                                    }
                                    if (s1 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c94();
                                    }
                                    s0 = s1;
                                    if (s0 === peg$FAILED) {
                                        s0 = peg$currPos;
                                        if (input.substr(peg$currPos, 6) === peg$c95) {
                                            s1 = peg$c95;
                                            peg$currPos += 6;
                                        } else {
                                            s1 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c96);
                                            }
                                        }
                                        if (s1 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c97();
                                        }
                                        s0 = s1;
                                        if (s0 === peg$FAILED) {
                                            s0 = peg$currPos;
                                            if (input.substr(peg$currPos, 7) === peg$c98) {
                                                s1 = peg$c98;
                                                peg$currPos += 7;
                                            } else {
                                                s1 = peg$FAILED;
                                                if (peg$silentFails === 0) {
                                                    peg$fail(peg$c99);
                                                }
                                            }
                                            if (s1 !== peg$FAILED) {
                                                peg$reportedPos = s0;
                                                s1 = peg$c100();
                                            }
                                            s0 = s1;
                                            if (s0 === peg$FAILED) {
                                                s0 = peg$currPos;
                                                if (input.substr(peg$currPos, 8) === peg$c101) {
                                                    s1 = peg$c101;
                                                    peg$currPos += 8;
                                                } else {
                                                    s1 = peg$FAILED;
                                                    if (peg$silentFails === 0) {
                                                        peg$fail(peg$c102);
                                                    }
                                                }
                                                if (s1 !== peg$FAILED) {
                                                    peg$reportedPos = s0;
                                                    s1 = peg$c103();
                                                }
                                                s0 = s1;
                                                if (s0 === peg$FAILED) {
                                                    s0 = peg$currPos;
                                                    if (input.substr(peg$currPos, 8) === peg$c104) {
                                                        s1 = peg$c104;
                                                        peg$currPos += 8;
                                                    } else {
                                                        s1 = peg$FAILED;
                                                        if (peg$silentFails === 0) {
                                                            peg$fail(peg$c105);
                                                        }
                                                    }
                                                    if (s1 !== peg$FAILED) {
                                                        peg$reportedPos = s0;
                                                        s1 = peg$c106();
                                                    }
                                                    s0 = s1;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsemultiplier() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 47) {
                            s1 = peg$c107;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c108);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsenumber();
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c109(s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.substr(peg$currPos, 2) === peg$c110) {
                                s1 = peg$c110;
                                peg$currPos += 2;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c111);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsenumber();
                                if (s2 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c109(s2);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                            if (s0 === peg$FAILED) {
                                s0 = peg$currPos;
                                if (input.substr(peg$currPos, 2) === peg$c112) {
                                    s1 = peg$c112;
                                    peg$currPos += 2;
                                } else {
                                    s1 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c113);
                                    }
                                }
                                if (s1 !== peg$FAILED) {
                                    s2 = peg$parsenumber();
                                    if (s2 !== peg$FAILED) {
                                        peg$reportedPos = s0;
                                        s1 = peg$c114(s2);
                                        s0 = s1;
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                                if (s0 === peg$FAILED) {
                                    s0 = peg$currPos;
                                    if (input.charCodeAt(peg$currPos) === 42) {
                                        s1 = peg$c115;
                                        peg$currPos++;
                                    } else {
                                        s1 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c116);
                                        }
                                    }
                                    if (s1 !== peg$FAILED) {
                                        s2 = peg$parsenumber();
                                        if (s2 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c117(s2);
                                            s0 = s1;
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                    } else {
                                        peg$currPos = s0;
                                        s0 = peg$c0;
                                    }
                                    if (s0 === peg$FAILED) {
                                        s0 = peg$currPos;
                                        if (input.substr(peg$currPos, 2) === peg$c118) {
                                            s1 = peg$c118;
                                            peg$currPos += 2;
                                        } else {
                                            s1 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c119);
                                            }
                                        }
                                        if (s1 !== peg$FAILED) {
                                            s2 = peg$parsenumber();
                                            if (s2 !== peg$FAILED) {
                                                peg$reportedPos = s0;
                                                s1 = peg$c117(s2);
                                                s0 = s1;
                                            } else {
                                                peg$currPos = s0;
                                                s0 = peg$c0;
                                            }
                                        } else {
                                            peg$currPos = s0;
                                            s0 = peg$c0;
                                        }
                                        if (s0 === peg$FAILED) {
                                            s0 = peg$currPos;
                                            if (input.substr(peg$currPos, 2) === peg$c120) {
                                                s1 = peg$c120;
                                                peg$currPos += 2;
                                            } else {
                                                s1 = peg$FAILED;
                                                if (peg$silentFails === 0) {
                                                    peg$fail(peg$c121);
                                                }
                                            }
                                            if (s1 !== peg$FAILED) {
                                                s2 = peg$parsenumber();
                                                if (s2 !== peg$FAILED) {
                                                    peg$reportedPos = s0;
                                                    s1 = peg$c122(s2);
                                                    s0 = s1;
                                                } else {
                                                    peg$currPos = s0;
                                                    s0 = peg$c0;
                                                }
                                            } else {
                                                peg$currPos = s0;
                                                s0 = peg$c0;
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parseconstantExpr() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        if (input.charCodeAt(peg$currPos) === 45) {
                            s1 = peg$c42;
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c43);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsenumber();
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c122(s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            if (input.charCodeAt(peg$currPos) === 43) {
                                s1 = peg$c76;
                                peg$currPos++;
                            } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c77);
                                }
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsenumber();
                                if (s2 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c117(s2);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        }

                        return s0;
                    }

                    function peg$parseviewNameRange() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = [];
                        if (peg$c123.test(input.charAt(peg$currPos))) {
                            s3 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c124);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                if (peg$c123.test(input.charAt(peg$currPos))) {
                                    s3 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s3 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c124);
                                    }
                                }
                            }
                        } else {
                            s2 = peg$c0;
                        }
                        if (s2 !== peg$FAILED) {
                            s2 = input.substring(s1, peg$currPos);
                        }
                        s1 = s2;
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            if (peg$c125.test(input.charAt(peg$currPos))) {
                                s4 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s4 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c126);
                                }
                            }
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                if (peg$c125.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c126);
                                    }
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s3 = input.substring(s2, peg$currPos);
                            }
                            s2 = s3;
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parserange();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c127(s1, s2, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$currPos;
                            s2 = [];
                            if (peg$c123.test(input.charAt(peg$currPos))) {
                                s3 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c124);
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                while (s3 !== peg$FAILED) {
                                    s2.push(s3);
                                    if (peg$c123.test(input.charAt(peg$currPos))) {
                                        s3 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s3 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c124);
                                        }
                                    }
                                }
                            } else {
                                s2 = peg$c0;
                            }
                            if (s2 !== peg$FAILED) {
                                s2 = input.substring(s1, peg$currPos);
                            }
                            s1 = s2;
                            if (s1 !== peg$FAILED) {
                                s2 = peg$currPos;
                                s3 = [];
                                if (peg$c125.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c126);
                                    }
                                }
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    if (peg$c125.test(input.charAt(peg$currPos))) {
                                        s4 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s4 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c126);
                                        }
                                    }
                                }
                                if (s3 !== peg$FAILED) {
                                    s3 = input.substring(s2, peg$currPos);
                                }
                                s2 = s3;
                                if (s2 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c128(s1, s2);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        }

                        return s0;
                    }

                    function peg$parseviewName() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$currPos;
                        s2 = [];
                        if (peg$c123.test(input.charAt(peg$currPos))) {
                            s3 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s3 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c124);
                            }
                        }
                        if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                if (peg$c123.test(input.charAt(peg$currPos))) {
                                    s3 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s3 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c124);
                                    }
                                }
                            }
                        } else {
                            s2 = peg$c0;
                        }
                        if (s2 !== peg$FAILED) {
                            s2 = input.substring(s1, peg$currPos);
                        }
                        s1 = s2;
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            if (peg$c125.test(input.charAt(peg$currPos))) {
                                s4 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s4 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c126);
                                }
                            }
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                if (peg$c125.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c126);
                                    }
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                s3 = input.substring(s2, peg$currPos);
                            }
                            s2 = s3;
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c128(s1, s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parserange() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c129) {
                            s1 = peg$c129;
                            peg$currPos += 2;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c130);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            if (peg$c71.test(input.charAt(peg$currPos))) {
                                s3 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s3 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c72);
                                }
                            }
                            if (s3 !== peg$FAILED) {
                                while (s3 !== peg$FAILED) {
                                    s2.push(s3);
                                    if (peg$c71.test(input.charAt(peg$currPos))) {
                                        s3 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s3 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c72);
                                        }
                                    }
                                }
                            } else {
                                s2 = peg$c0;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c131(s2);
                                s0 = s1;
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }

                        return s0;
                    }

                    function peg$parsenumber() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = [];
                        if (peg$c71.test(input.charAt(peg$currPos))) {
                            s2 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c72);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                if (peg$c71.test(input.charAt(peg$currPos))) {
                                    s2 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c72);
                                    }
                                }
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 46) {
                                s2 = peg$c132;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c133);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                if (peg$c71.test(input.charAt(peg$currPos))) {
                                    s4 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s4 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c72);
                                    }
                                }
                                if (s4 !== peg$FAILED) {
                                    while (s4 !== peg$FAILED) {
                                        s3.push(s4);
                                        if (peg$c71.test(input.charAt(peg$currPos))) {
                                            s4 = input.charAt(peg$currPos);
                                            peg$currPos++;
                                        } else {
                                            s4 = peg$FAILED;
                                            if (peg$silentFails === 0) {
                                                peg$fail(peg$c72);
                                            }
                                        }
                                    }
                                } else {
                                    s3 = peg$c0;
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c134(s1, s3);
                                    s0 = s1;
                                } else {
                                    peg$currPos = s0;
                                    s0 = peg$c0;
                                }
                            } else {
                                peg$currPos = s0;
                                s0 = peg$c0;
                            }
                        } else {
                            peg$currPos = s0;
                            s0 = peg$c0;
                        }
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = [];
                            if (peg$c71.test(input.charAt(peg$currPos))) {
                                s2 = input.charAt(peg$currPos);
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c72);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                while (s2 !== peg$FAILED) {
                                    s1.push(s2);
                                    if (peg$c71.test(input.charAt(peg$currPos))) {
                                        s2 = input.charAt(peg$currPos);
                                        peg$currPos++;
                                    } else {
                                        s2 = peg$FAILED;
                                        if (peg$silentFails === 0) {
                                            peg$fail(peg$c72);
                                        }
                                    }
                                }
                            } else {
                                s1 = peg$c0;
                            }
                            if (s1 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c135(s1);
                            }
                            s0 = s1;
                        }

                        return s0;
                    }

                    function extend(dst) {
                        for (var i = 1; i < arguments.length; i++) {
                            for (var k in arguments[i]) {
                                dst[k] = arguments[i][k];
                            }
                        }
                        return dst;
                    }

                    peg$result = peg$startRuleFunction();

                    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
                        return peg$result;
                    } else {
                        if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                            peg$fail({type: "end", description: "end of input"});
                        }

                        throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
                    }
                }

                return {
                    SyntaxError: SyntaxError,
                    parse: parse
                };
            }();

            var Orientation = {
                HORIZONTAL: 1,
                VERTICAL: 2,
                ZINDEX: 4
            };

            /**
             * Helper function that inserts equal spacers (~).
             * @private
             */
            function _processEqualSpacer(context, stackView) {

                // Determine unique name for the spacer
                context.equalSpacerIndex = context.equalSpacerIndex || 1;
                var name = '_~' + context.lineIndex + ':' + context.equalSpacerIndex + '~';
                if (context.equalSpacerIndex > 1) {

                    // Ensure that all spacers have the same width/height
                    context.constraints.push({
                        view1: '_~' + context.lineIndex + ':1~',
                        attr1: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                        relation: context.relation.relation || Relation.EQU,
                        view2: name,
                        attr2: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                        priority: context.relation.priority
                    });
                }
                context.equalSpacerIndex++;

                // Enforce view/proportional width/height
                if (context.relation.view || context.relation.multiplier && context.relation.multiplier !== 1) {
                    context.constraints.push({
                        view1: name,
                        attr1: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                        relation: context.relation.relation || Relation.EQU,
                        view2: context.relation.view,
                        attr2: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                        priority: context.relation.priority,
                        multiplier: context.relation.multiplier
                    });
                    context.relation.multiplier = undefined;
                } else if (context.relation.constant) {
                    context.constraints.push({
                        view1: name,
                        attr1: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                        relation: Relation.EQU,
                        view2: null,
                        attr2: Attribute.CONST,
                        priority: context.relation.priority,
                        constant: context.relation.constant
                    });
                    context.relation.constant = undefined;
                }

                // Add constraint
                for (var i = 0; i < context.prevViews.length; i++) {
                    var prevView = context.prevViews[i];
                    switch (context.orientation) {
                        case Orientation.HORIZONTAL:
                            context.prevAttr = prevView !== stackView ? Attribute.RIGHT : Attribute.LEFT;
                            context.curAttr = Attribute.LEFT;
                            break;
                        case Orientation.VERTICAL:
                            context.prevAttr = prevView !== stackView ? Attribute.BOTTOM : Attribute.TOP;
                            context.curAttr = Attribute.TOP;
                            break;
                        case Orientation.ZINDEX:
                            context.prevAttr = Attribute.ZINDEX;
                            context.curAttr = Attribute.ZINDEX;
                            context.relation.constant = prevView !== stackView ? 'default' : 0;
                            break;
                    }
                    context.constraints.push({
                        view1: prevView,
                        attr1: context.prevAttr,
                        relation: context.relation.relation,
                        view2: name,
                        attr2: context.curAttr,
                        priority: context.relation.priority
                    });
                }
                context.prevViews = [name];
            }

            /**
             * Helper function that inserts proportional spacers (-12%-).
             * @private
             */
            function _processProportionalSpacer(context, stackView) {
                context.proportionalSpacerIndex = context.proportionalSpacerIndex || 1;
                var name = '_-' + context.lineIndex + ':' + context.proportionalSpacerIndex + '-';
                context.proportionalSpacerIndex++;
                context.constraints.push({
                    view1: name,
                    attr1: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                    relation: context.relation.relation || Relation.EQU,
                    view2: context.relation.view, // or relative to the stackView... food for thought
                    attr2: context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT,
                    priority: context.relation.priority,
                    multiplier: context.relation.multiplier
                });
                context.relation.multiplier = undefined;

                // Add constraint
                for (var i = 0; i < context.prevViews.length; i++) {
                    var prevView = context.prevViews[i];
                    switch (context.orientation) {
                        case Orientation.HORIZONTAL:
                            context.prevAttr = prevView !== stackView ? Attribute.RIGHT : Attribute.LEFT;
                            context.curAttr = Attribute.LEFT;
                            break;
                        case Orientation.VERTICAL:
                            context.prevAttr = prevView !== stackView ? Attribute.BOTTOM : Attribute.TOP;
                            context.curAttr = Attribute.TOP;
                            break;
                        case Orientation.ZINDEX:
                            context.prevAttr = Attribute.ZINDEX;
                            context.curAttr = Attribute.ZINDEX;
                            context.relation.constant = prevView !== stackView ? 'default' : 0;
                            break;
                    }
                    context.constraints.push({
                        view1: prevView,
                        attr1: context.prevAttr,
                        relation: context.relation.relation,
                        view2: name,
                        attr2: context.curAttr,
                        priority: context.relation.priority
                    });
                }
                context.prevViews = [name];
            }

            /**
             * In case of a stack-view, set constraints for opposite orientations
             * @private
             */
            function _processStackView(context, name, subView) {
                var viewName = void 0;
                for (var orientation = 1; orientation <= 4; orientation *= 2) {
                    if (subView.orientations & orientation && subView.stack.orientation !== orientation && !(subView.stack.processedOrientations & orientation)) {
                        subView.stack.processedOrientations = subView.stack.processedOrientations | orientation;
                        viewName = viewName || {
                            name: name,
                            type: 'stack'
                        };
                        for (var i = 0, j = subView.stack.subViews.length; i < j; i++) {
                            if (orientation === Orientation.ZINDEX) {
                                context.constraints.push({
                                    view1: viewName,
                                    attr1: Attribute.ZINDEX,
                                    relation: Relation.EQU,
                                    view2: subView.stack.subViews[i],
                                    attr2: Attribute.ZINDEX
                                });
                            } else {
                                context.constraints.push({
                                    view1: viewName,
                                    attr1: orientation === Orientation.VERTICAL ? Attribute.HEIGHT : Attribute.WIDTH,
                                    relation: Relation.EQU,
                                    view2: subView.stack.subViews[i],
                                    attr2: orientation === Orientation.VERTICAL ? Attribute.HEIGHT : Attribute.WIDTH
                                });
                                context.constraints.push({
                                    view1: viewName,
                                    attr1: orientation === Orientation.VERTICAL ? Attribute.TOP : Attribute.LEFT,
                                    relation: Relation.EQU,
                                    view2: subView.stack.subViews[i],
                                    attr2: orientation === Orientation.VERTICAL ? Attribute.TOP : Attribute.LEFT
                                });
                            }
                        }
                    }
                }
            }

            /**
             * Recursive helper function converts a view-name and a range to a series
             * of view-names (e.g. [child1, child2, child3, ...]).
             * @private
             */
            function _getRange(name, range) {
                if (range === true) {
                    range = name.match(/\.\.\d+$/);
                    if (range) {
                        name = name.substring(0, name.length - range[0].length);
                        range = parseInt(range[0].substring(2));
                    }
                }
                if (!range) {
                    return [name];
                }
                var start = name.match(/\d+$/);
                var res = [];
                var i;
                if (start) {
                    name = name.substring(0, name.length - start[0].length);
                    for (i = parseInt(start); i <= range; i++) {
                        res.push(name + i);
                    }
                } else {
                    res.push(name);
                    for (i = 2; i <= range; i++) {
                        res.push(name + i);
                    }
                }
                return res;
            }

            /**
             * Recursive helper function that processes the cascaded data.
             * @private
             */
            function _processCascade(context, cascade, parentItem) {
                var stackView = parentItem ? parentItem.view : null;
                var subViews = [];
                var curViews = [];
                var subView = void 0;
                if (stackView) {
                    cascade.push({view: stackView});
                    curViews.push(stackView);
                }
                for (var i = 0; i < cascade.length; i++) {
                    var item = cascade[i];
                    if (!Array.isArray(item) && item.hasOwnProperty('view') || Array.isArray(item) && item[0].view && !item[0].relation) {
                        var items = Array.isArray(item) ? item : [item];
                        for (var z = 0; z < items.length; z++) {
                            item = items[z];
                            var viewRange = item === ',' ? [] : item.view ? _getRange(item.view, item.range) : [null];
                            for (var r = 0; r < viewRange.length; r++) {
                                var curView = viewRange[r];
                                curViews.push(curView);

                                //
                                // Add this view to the collection of subViews
                                //
                                if (curView !== stackView) {
                                    subViews.push(curView);
                                    subView = context.subViews[curView];
                                    if (!subView) {
                                        subView = {orientations: 0};
                                        context.subViews[curView] = subView;
                                    }
                                    subView.orientations = subView.orientations | context.orientation;
                                    if (subView.stack) {
                                        _processStackView(context, curView, subView);
                                    }
                                }

                                //
                                // Process the relationship between this and the previous views
                                //
                                if (context.prevViews !== undefined && curView !== undefined && context.relation) {
                                    if (context.relation.relation !== 'none') {
                                        for (var p = 0; p < context.prevViews.length; p++) {
                                            var prevView = context.prevViews[p];
                                            switch (context.orientation) {
                                                case Orientation.HORIZONTAL:
                                                    context.prevAttr = prevView !== stackView ? Attribute.RIGHT : Attribute.LEFT;
                                                    context.curAttr = curView !== stackView ? Attribute.LEFT : Attribute.RIGHT;
                                                    break;
                                                case Orientation.VERTICAL:
                                                    context.prevAttr = prevView !== stackView ? Attribute.BOTTOM : Attribute.TOP;
                                                    context.curAttr = curView !== stackView ? Attribute.TOP : Attribute.BOTTOM;
                                                    break;
                                                case Orientation.ZINDEX:
                                                    context.prevAttr = Attribute.ZINDEX;
                                                    context.curAttr = Attribute.ZINDEX;
                                                    context.relation.constant = !prevView ? 0 : context.relation.constant || 'default';
                                                    break;
                                            }
                                            context.constraints.push({
                                                view1: prevView,
                                                attr1: context.prevAttr,
                                                relation: context.relation.relation,
                                                view2: curView,
                                                attr2: context.curAttr,
                                                multiplier: context.relation.multiplier,
                                                constant: context.relation.constant === 'default' || !context.relation.constant ? context.relation.constant : -context.relation.constant,
                                                priority: context.relation.priority
                                            });
                                        }
                                    }
                                }

                                //
                                // Process view size constraints
                                //
                                var constraints = item.constraints;
                                if (constraints) {
                                    for (var n = 0; n < constraints.length; n++) {
                                        context.prevAttr = context.horizontal ? Attribute.WIDTH : Attribute.HEIGHT;
                                        context.curAttr = constraints[n].view || constraints[n].multiplier ? constraints[n].attribute || context.prevAttr : constraints[n].variable ? Attribute.VARIABLE : Attribute.CONST;
                                        context.constraints.push({
                                            view1: curView,
                                            attr1: context.prevAttr,
                                            relation: constraints[n].relation,
                                            view2: constraints[n].view,
                                            attr2: context.curAttr,
                                            multiplier: constraints[n].multiplier,
                                            constant: constraints[n].constant,
                                            priority: constraints[n].priority
                                        });
                                    }
                                }

                                //
                                // Process cascaded data (child stack-views)
                                //
                                if (item.cascade) {
                                    _processCascade(context, item.cascade, item);
                                }
                            }
                        }
                    } else if (item !== ',') {
                        context.prevViews = curViews;
                        curViews = [];
                        context.relation = item[0];
                        if (context.prevViews !== undefined) {
                            if (context.relation.equalSpacing) {
                                _processEqualSpacer(context, stackView);
                            }
                            if (context.relation.multiplier) {
                                _processProportionalSpacer(context, stackView);
                            }
                        }
                    }
                }

                if (stackView) {
                    subView = context.subViews[stackView];
                    if (!subView) {
                        subView = {orientations: context.orientation};
                        context.subViews[stackView] = subView;
                    } else if (subView.stack) {
                        var err = new Error('A stack named "' + stackView + '" has already been created');
                        err.column = parentItem.$parserOffset + 1;
                        throw err;
                    }
                    subView.stack = {
                        orientation: context.orientation,
                        processedOrientations: context.orientation,
                        subViews: subViews
                    };
                    _processStackView(context, stackView, subView);
                }
            }

            var metaInfoCategories = ['viewport', 'spacing', 'colors', 'shapes', 'widths', 'heights'];

            /**
             * VisualFormat
             *
             * @namespace VisualFormat
             */

            var VisualFormat = function () {
                function VisualFormat() {
                    _classCallCheck(this, VisualFormat);
                }

                _createClass(VisualFormat, null, [{
                    key: 'parseLine',


                    /**
                     * Parses a single line of vfl into an array of constraint definitions.
                     *
                     * When the visual-format could not be succesfully parsed an exception is thrown containing
                     * additional info about the parse error and column position.
                     *
                     * @param {String} visualFormat Visual format string (cannot contain line-endings!).
                     * @param {Object} [options] Configuration options.
                     * @param {Boolean} [options.extended] When set to true uses the extended syntax (default: false).
                     * @param {String} [options.outFormat] Output format (`constraints` or `raw`) (default: `constraints`).
                     * @param {Number} [options.lineIndex] Line-index used when auto generating equal-spacing constraints.
                     * @return {Array} Array of constraint definitions.
                     */
                    value: function parseLine(visualFormat, options) {
                        if (visualFormat.length === 0 || options && options.extended && visualFormat.indexOf('//') === 0) {
                            return [];
                        }
                        var res = options && options.extended ? parserExt.parse(visualFormat) : parser.parse(visualFormat);
                        if (options && options.outFormat === 'raw') {
                            return [res];
                        }
                        var context = {
                            constraints: [],
                            lineIndex: (options ? options.lineIndex : undefined) || 1,
                            subViews: (options ? options.subViews : undefined) || {}
                        };
                        if (res.type === 'attribute') {
                            for (var n = 0; n < res.attributes.length; n++) {
                                var attr = res.attributes[n];
                                for (var m = 0; m < attr.predicates.length; m++) {
                                    var predicate = attr.predicates[m];
                                    context.constraints.push({
                                        view1: res.view,
                                        attr1: attr.attr,
                                        relation: predicate.relation,
                                        view2: predicate.view,
                                        attr2: predicate.attribute || attr.attr,
                                        multiplier: predicate.multiplier,
                                        constant: predicate.constant,
                                        priority: predicate.priority
                                    });
                                }
                            }
                        } else {
                            switch (res.orientation) {
                                case 'horizontal':
                                    context.orientation = Orientation.HORIZONTAL;
                                    context.horizontal = true;
                                    _processCascade(context, res.cascade, null);
                                    break;
                                case 'vertical':
                                    context.orientation = Orientation.VERTICAL;
                                    _processCascade(context, res.cascade, null);
                                    break;
                                case 'horzvert':
                                    context.orientation = Orientation.HORIZONTAL;
                                    context.horizontal = true;
                                    _processCascade(context, res.cascade, null);
                                    context = {
                                        constraints: context.constraints,
                                        lineIndex: context.lineIndex,
                                        subViews: context.subViews,
                                        orientation: Orientation.VERTICAL
                                    };
                                    _processCascade(context, res.cascade, null);
                                    break;
                                case 'zIndex':
                                    context.orientation = Orientation.ZINDEX;
                                    _processCascade(context, res.cascade, null);
                                    break;
                            }
                        }
                        return context.constraints;
                    }

                    /**
                     * Parses one or more visual format strings into an array of constraint definitions.
                     *
                     * When the visual-format could not be succesfully parsed an exception is thrown containing
                     * additional info about the parse error and column position.
                     *
                     * @param {String|Array} visualFormat One or more visual format strings.
                     * @param {Object} [options] Configuration options.
                     * @param {Boolean} [options.extended] When set to true uses the extended syntax (default: false).
                     * @param {Boolean} [options.strict] When set to false trims any leading/trailing spaces and ignores empty lines (default: true).
                     * @param {String} [options.lineSeparator] String that defines the end of a line (default `\n`).
                     * @param {String} [options.outFormat] Output format (`constraints` or `raw`) (default: `constraints`).
                     * @return {Array} Array of constraint definitions.
                     */

                }, {
                    key: 'parse',
                    value: function parse(visualFormat, options) {
                        var lineSeparator = options && options.lineSeparator ? options.lineSeparator : '\n';
                        if (!Array.isArray(visualFormat) && visualFormat.indexOf(lineSeparator) < 0) {
                            try {
                                return this.parseLine(visualFormat, options);
                            } catch (err) {
                                err.source = visualFormat;
                                throw err;
                            }
                        }

                        // Decompose visual-format into an array of strings, and within those strings
                        // search for line-endings, and treat each line as a seperate visual-format.
                        visualFormat = Array.isArray(visualFormat) ? visualFormat : [visualFormat];
                        var lines = void 0;
                        var constraints = [];
                        var lineIndex = 0;
                        var line = void 0;
                        var parseOptions = {
                            lineIndex: lineIndex,
                            extended: options && options.extended,
                            strict: options && options.strict !== undefined ? options.strict : true,
                            outFormat: options ? options.outFormat : undefined,
                            subViews: {}
                        };
                        try {
                            for (var i = 0; i < visualFormat.length; i++) {
                                lines = visualFormat[i].split(lineSeparator);
                                for (var j = 0; j < lines.length; j++) {
                                    line = lines[j];
                                    lineIndex++;
                                    parseOptions.lineIndex = lineIndex;
                                    if (!parseOptions.strict) {
                                        line = line.trim();
                                    }
                                    if (parseOptions.strict || line.length) {
                                        constraints = constraints.concat(this.parseLine(line, parseOptions));
                                    }
                                }
                            }
                        } catch (err) {
                            err.source = line;
                            err.line = lineIndex;
                            throw err;
                        }
                        return constraints;
                    }

                    /**
                     * Parses meta information from the comments in the VFL.
                     *
                     * Additional meta information can be specified in the comments
                     * for previewing and rendering purposes. For instance, the view-port
                     * aspect-ratio, sub-view widths and colors, can be specified. The
                     * following example renders three colored circles in the visual-format editor:
                     *
                     * ```vfl
                     * //viewport aspect-ratio:3/1 max-height:300
                     * //colors red:#FF0000 green:#00FF00 blue:#0000FF
                     * //shapes red:circle green:circle blue:circle
                     * H:|-[row:[red(green,blue)]-[green]-[blue]]-|
                     * V:|[row]|
                     * ```
                     *
                     * Supported categories and properties:
                     *
                     * |Category|Property|Example|
                     * |--------|--------|-------|
                     * |`viewport`|`aspect-ratio:{width}/{height}`|`//viewport aspect-ratio:16/9`|
                     * ||`width:[{number}/intrinsic]`|`//viewport width:10`|
                     * ||`height:[{number}/intrinsic]`|`//viewport height:intrinsic`|
                     * ||`min-width:{number}`|
                     * ||`max-width:{number}`|
                     * ||`min-height:{number}`|
                     * ||`max-height:{number}`|
                     * |`spacing`|`[{number}/array]`|`//spacing:8` or `//spacing:[10, 20, 5]`|
                     * |`widths`|`{view-name}:[{number}/intrinsic]`|`//widths subview1:100`|
                     * |`heights`|`{view-name}:[{number}/intrinsic]`|`//heights subview1:intrinsic`|
                     * |`colors`|`{view-name}:{color}`|`//colors redview:#FF0000 blueview:#00FF00`|
                     * |`shapes`|`{view-name}:[circle/square]`|`//shapes avatar:circle`|
                     *
                     * @param {String|Array} visualFormat One or more visual format strings.
                     * @param {Object} [options] Configuration options.
                     * @param {String} [options.lineSeparator] String that defines the end of a line (default `\n`).
                     * @param {String} [options.prefix] When specified, also processes the categories using that prefix (e.g. "-dev-viewport max-height:10").
                     * @return {Object} meta-info
                     */

                }, {
                    key: 'parseMetaInfo',
                    value: function parseMetaInfo(visualFormat, options) {
                        var lineSeparator = options && options.lineSeparator ? options.lineSeparator : '\n';
                        var prefix = options ? options.prefix : undefined;
                        visualFormat = Array.isArray(visualFormat) ? visualFormat : [visualFormat];
                        var metaInfo = {};
                        var key;
                        for (var k = 0; k < visualFormat.length; k++) {
                            var lines = visualFormat[k].split(lineSeparator);
                            for (var i = 0; i < lines.length; i++) {
                                var line = lines[i];
                                for (var c = 0; c < metaInfoCategories.length; c++) {
                                    for (var s = 0; s < (prefix ? 2 : 1); s++) {
                                        var category = metaInfoCategories[c];
                                        var prefixedCategory = (s === 0 ? '' : prefix) + category;
                                        if (line.indexOf('//' + prefixedCategory + ' ') === 0) {
                                            var items = line.substring(3 + prefixedCategory.length).split(' ');
                                            for (var j = 0; j < items.length; j++) {
                                                metaInfo[category] = metaInfo[category] || {};
                                                var item = items[j].split(':');
                                                var names = _getRange(item[0], true);
                                                for (var r = 0; r < names.length; r++) {
                                                    metaInfo[category][names[r]] = item.length > 1 ? item[1] : '';
                                                }
                                            }
                                        } else if (line.indexOf('//' + prefixedCategory + ':') === 0) {
                                            metaInfo[category] = line.substring(3 + prefixedCategory.length);
                                        }
                                    }
                                }
                            }
                        }
                        if (metaInfo.viewport) {
                            var viewport = metaInfo.viewport;
                            var aspectRatio = viewport['aspect-ratio'];
                            if (aspectRatio) {
                                aspectRatio = aspectRatio.split('/');
                                viewport['aspect-ratio'] = parseInt(aspectRatio[0]) / parseInt(aspectRatio[1]);
                            }
                            if (viewport.height !== undefined) {
                                viewport.height = viewport.height === 'intrinsic' ? true : parseInt(viewport.height);
                            }
                            if (viewport.width !== undefined) {
                                viewport.width = viewport.width === 'intrinsic' ? true : parseInt(viewport.width);
                            }
                            if (viewport['max-height'] !== undefined) {
                                viewport['max-height'] = parseInt(viewport['max-height']);
                            }
                            if (viewport['max-width'] !== undefined) {
                                viewport['max-width'] = parseInt(viewport['max-width']);
                            }
                            if (viewport['min-height'] !== undefined) {
                                viewport['min-height'] = parseInt(viewport['min-height']);
                            }
                            if (viewport['min-width'] !== undefined) {
                                viewport['min-width'] = parseInt(viewport['min-width']);
                            }
                        }
                        if (metaInfo.widths) {
                            for (key in metaInfo.widths) {
                                var width = metaInfo.widths[key] === 'intrinsic' ? true : parseInt(metaInfo.widths[key]);
                                metaInfo.widths[key] = width;
                                if (width === undefined || isNaN(width)) {
                                    delete metaInfo.widths[key];
                                }
                            }
                        }
                        if (metaInfo.heights) {
                            for (key in metaInfo.heights) {
                                var height = metaInfo.heights[key] === 'intrinsic' ? true : parseInt(metaInfo.heights[key]);
                                metaInfo.heights[key] = height;
                                if (height === undefined || isNaN(height)) {
                                    delete metaInfo.heights[key];
                                }
                            }
                        }
                        if (metaInfo.spacing) {
                            var value = JSON.parse(metaInfo.spacing);
                            metaInfo.spacing = value;
                            if (Array.isArray(value)) {
                                for (var sIdx = 0, len = value.length; sIdx < len; sIdx++) {
                                    if (isNaN(value[sIdx])) {
                                        delete metaInfo.spacing;
                                        break;
                                    }
                                }
                            } else if (value === undefined || isNaN(value)) {
                                delete metaInfo.spacing;
                            }
                        }
                        return metaInfo;
                    }
                }]);

                return VisualFormat;
            }();

            /**
             * A SubView is automatically generated when constraints are added to a View.
             *
             * @namespace SubView
             */


            var SubView = function () {
                function SubView(options) {
                    _classCallCheck(this, SubView);

                    this._name = options.name;
                    this._type = options.type;
                    this._solver = options.solver;
                    this._attr = {};
                    if (!options.name) {
                        if (true) {
                            this._attr[Attribute.LEFT] = new c.Variable();
                            this._solver.addConstraint(new c.StayConstraint(this._attr[Attribute.LEFT], c.Strength.required));
                            this._attr[Attribute.TOP] = new c.Variable();
                            this._solver.addConstraint(new c.StayConstraint(this._attr[Attribute.TOP], c.Strength.required));
                            this._attr[Attribute.ZINDEX] = new c.Variable();
                            this._solver.addConstraint(new c.StayConstraint(this._attr[Attribute.ZINDEX], c.Strength.required));
                        } else {
                            this._attr[Attribute.LEFT] = new kiwi.Variable();
                            this._solver.addConstraint(new kiwi.Constraint(this._attr[Attribute.LEFT], kiwi.Operator.Eq, 0));
                            this._attr[Attribute.TOP] = new kiwi.Variable();
                            this._solver.addConstraint(new kiwi.Constraint(this._attr[Attribute.TOP], kiwi.Operator.Eq, 0));
                            this._attr[Attribute.ZINDEX] = new kiwi.Variable();
                            this._solver.addConstraint(new kiwi.Constraint(this._attr[Attribute.ZINDEX], kiwi.Operator.Eq, 0));
                        }
                    }
                }

                _createClass(SubView, [{
                    key: 'toJSON',
                    value: function toJSON() {
                        return {
                            name: this.name,
                            left: this.left,
                            top: this.top,
                            width: this.width,
                            height: this.height
                        };
                    }
                }, {
                    key: 'toString',
                    value: function toString() {
                        JSON.stringify(this.toJSON(), undefined, 2);
                    }

                    /**
                     * Name of the sub-view.
                     * @readonly
                     * @type {String}
                     */

                }, {
                    key: 'getValue',


                    /**
                     * Gets the value of one of the attributes.
                     *
                     * @param {String|Attribute} attr Attribute name (e.g. 'right', 'centerY', Attribute.TOP).
                     * @return {Number} value or `undefined`
                     */
                    value: function getValue(attr) {
                        return this._attr[attr] ? this._attr[attr].value() : undefined;
                    }

                    /**
                     * @private
                     */

                }, {
                    key: '_getAttr',
                    value: function _getAttr(attr) {
                        if (this._attr[attr]) {
                            return this._attr[attr];
                        }
                        this._attr[attr] = true ? new c.Variable() : new kiwi.Variable();
                        switch (attr) {
                            case Attribute.RIGHT:
                                this._getAttr(Attribute.LEFT);
                                this._getAttr(Attribute.WIDTH);
                                if (true) {
                                    this._solver.addConstraint(new c.Equation(this._attr[attr], c.plus(this._attr[Attribute.LEFT], this._attr[Attribute.WIDTH])));
                                } else {
                                    this._solver.addConstraint(new kiwi.Constraint(this._attr[attr], kiwi.Operator.Eq, this._attr[Attribute.LEFT].plus(this._attr[Attribute.WIDTH])));
                                }
                                break;
                            case Attribute.BOTTOM:
                                this._getAttr(Attribute.TOP);
                                this._getAttr(Attribute.HEIGHT);
                                if (true) {
                                    this._solver.addConstraint(new c.Equation(this._attr[attr], c.plus(this._attr[Attribute.TOP], this._attr[Attribute.HEIGHT])));
                                } else {
                                    this._solver.addConstraint(new kiwi.Constraint(this._attr[attr], kiwi.Operator.Eq, this._attr[Attribute.TOP].plus(this._attr[Attribute.HEIGHT])));
                                }
                                break;
                            case Attribute.CENTERX:
                                this._getAttr(Attribute.LEFT);
                                this._getAttr(Attribute.WIDTH);
                                if (true) {
                                    this._solver.addConstraint(new c.Equation(this._attr[attr], c.plus(this._attr[Attribute.LEFT], c.divide(this._attr[Attribute.WIDTH], 2))));
                                } else {
                                    this._solver.addConstraint(new kiwi.Constraint(this._attr[attr], kiwi.Operator.Eq, this._attr[Attribute.LEFT].plus(this._attr[Attribute.WIDTH].divide(2))));
                                }
                                break;
                            case Attribute.CENTERY:
                                this._getAttr(Attribute.TOP);
                                this._getAttr(Attribute.HEIGHT);
                                if (true) {
                                    this._solver.addConstraint(new c.Equation(this._attr[attr], c.plus(this._attr[Attribute.TOP], c.divide(this._attr[Attribute.HEIGHT], 2))));
                                } else {
                                    this._solver.addConstraint(new kiwi.Constraint(this._attr[attr], kiwi.Operator.Eq, this._attr[Attribute.TOP].plus(this._attr[Attribute.HEIGHT].divide(2))));
                                }
                                break;
                        }
                        if (!true) {
                            this._solver.updateVariables();
                        }
                        return this._attr[attr];
                    }

                    /**
                     * @private
                     */

                }, {
                    key: '_getAttrValue',
                    value: function _getAttrValue(attr) {
                        if (true) {
                            return this._getAttr(attr).value;
                        } else {
                            return this._getAttr(attr).value();
                        }
                    }
                }, {
                    key: 'name',
                    get: function get() {
                        return this._name;
                    }

                    /**
                     * Left value (`Attribute.LEFT`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'left',
                    get: function get() {
                        return this._getAttrValue(Attribute.LEFT);
                    }

                    /**
                     * Right value (`Attribute.RIGHT`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'right',
                    get: function get() {
                        return this._getAttrValue(Attribute.RIGHT);
                    }

                    /**
                     * Width value (`Attribute.WIDTH`).
                     * @type {Number}
                     */

                }, {
                    key: 'width',
                    get: function get() {
                        return this._getAttrValue(Attribute.WIDTH);
                    }

                    /**
                     * Height value (`Attribute.HEIGHT`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'height',
                    get: function get() {
                        return this._getAttrValue(Attribute.HEIGHT);
                    }

                    /**
                     * Intrinsic width of the sub-view.
                     *
                     * Use this property to explicitely set the width of the sub-view, e.g.:
                     * ```javascript
                     * var view = new AutoLayout.View(AutoLayout.VisualFormat.parse('|[child1][child2]|'), {
                     *   width: 500
                     * });
                     * view.subViews.child1.intrinsicWidth = 100;
                     * console.log('child2 width: ' + view.subViews.child2.width); // 400
                     * ```
                     *
                     * @type {Number}
                     */

                }, {
                    key: 'intrinsicWidth',
                    get: function get() {
                        return this._intrinsicWidth;
                    },
                    set: function set(value) {
                        if (value !== undefined && value !== this._intrinsicWidth) {
                            var attr = this._getAttr(Attribute.WIDTH);
                            if (this._intrinsicWidth === undefined) {
                                if (true) {
                                    this._solver.addEditVar(attr, new c.Strength('required', this._name ? 998 : 999, 1000, 1000));
                                } else {
                                    this._solver.addEditVariable(attr, kiwi.Strength.create(this._name ? 998 : 999, 1000, 1000));
                                }
                            }
                            this._intrinsicWidth = value;
                            this._solver.suggestValue(attr, value);
                            if (true) {
                                this._solver.resolve();
                            } else {
                                this._solver.updateVariables();
                            }
                        }
                    }

                    /**
                     * Intrinsic height of the sub-view.
                     *
                     * See `intrinsicWidth`.
                     *
                     * @type {Number}
                     */

                }, {
                    key: 'intrinsicHeight',
                    get: function get() {
                        return this._intrinsicHeight;
                    },
                    set: function set(value) {
                        if (value !== undefined && value !== this._intrinsicHeight) {
                            var attr = this._getAttr(Attribute.HEIGHT);
                            if (this._intrinsicHeight === undefined) {
                                if (true) {
                                    this._solver.addEditVar(attr, new c.Strength('required', this._name ? 998 : 999, 1000, 1000));
                                } else {
                                    this._solver.addEditVariable(attr, kiwi.Strength.create(this._name ? 998 : 999, 1000, 1000));
                                }
                            }
                            this._intrinsicHeight = value;
                            this._solver.suggestValue(attr, value);
                            if (true) {
                                this._solver.resolve();
                            } else {
                                this._solver.updateVariables();
                            }
                        }
                    }

                    /**
                     * Top value (`Attribute.TOP`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'top',
                    get: function get() {
                        return this._getAttrValue(Attribute.TOP);
                    }

                    /**
                     * Bottom value (`Attribute.BOTTOM`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'bottom',
                    get: function get() {
                        return this._getAttrValue(Attribute.BOTTOM);
                    }

                    /**
                     * Horizontal center (`Attribute.CENTERX`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'centerX',
                    get: function get() {
                        return this._getAttrValue(Attribute.CENTERX);
                    }

                    /**
                     * Vertical center (`Attribute.CENTERY`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'centerY',
                    get: function get() {
                        return this._getAttrValue(Attribute.CENTERY);
                    }

                    /**
                     * Z-index (`Attribute.ZINDEX`).
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'zIndex',
                    get: function get() {
                        return this._getAttrValue(Attribute.ZINDEX);
                    }

                    /**
                     * Returns the type of the sub-view.
                     * @readonly
                     * @type {String}
                     */

                }, {
                    key: 'type',
                    get: function get() {
                        return this._type;
                    }
                }]);

                return SubView;
            }();

            var defaultPriorityStrength = true ? new c.Strength('defaultPriority', 0, 1000, 1000) : kiwi.Strength.create(0, 1000, 1000);

            function _getConst(name, value) {
                if (true) {
                    var vr = new c.Variable({value: value});
                    this._solver.addConstraint(new c.StayConstraint(vr, c.Strength.required, 0));
                    return vr;
                } else {
                    var _vr = new kiwi.Variable();
                    this._solver.addConstraint(new kiwi.Constraint(_vr, kiwi.Operator.Eq, value));
                    return _vr;
                }
            }

            function _getSubView(viewName) {
                if (!viewName) {
                    return this._parentSubView;
                } else if (viewName.name) {
                    this._subViews[viewName.name] = this._subViews[viewName.name] || new SubView({
                        name: viewName.name,
                        solver: this._solver
                    });
                    this._subViews[viewName.name]._type = this._subViews[viewName.name]._type || viewName.type;
                    return this._subViews[viewName.name];
                } else {
                    this._subViews[viewName] = this._subViews[viewName] || new SubView({
                        name: viewName,
                        solver: this._solver
                    });
                    return this._subViews[viewName];
                }
            }

            function _getSpacing(constraint) {
                var index = 4;
                if (!constraint.view1 && constraint.attr1 === 'left') {
                    index = 3;
                } else if (!constraint.view1 && constraint.attr1 === 'top') {
                    index = 0;
                } else if (!constraint.view2 && constraint.attr2 === 'right') {
                    index = 1;
                } else if (!constraint.view2 && constraint.attr2 === 'bottom') {
                    index = 2;
                } else {
                    switch (constraint.attr1) {
                        case 'left':
                        case 'right':
                        case 'centerX':
                        case 'leading':
                        case 'trailing':
                            index = 4;
                            break;
                        case 'zIndex':
                            index = 6;
                            break;
                        default:
                            index = 5;
                    }
                }
                this._spacingVars = this._spacingVars || new Array(7);
                this._spacingExpr = this._spacingExpr || new Array(7);
                if (!this._spacingVars[index]) {
                    if (true) {
                        this._spacingVars[index] = new c.Variable();
                        this._solver.addEditVar(this._spacingVars[index]);
                        this._spacingExpr[index] = c.minus(0, this._spacingVars[index]);
                    } else {
                        this._spacingVars[index] = new kiwi.Variable();
                        this._solver.addEditVariable(this._spacingVars[index], kiwi.Strength.create(999, 1000, 1000));
                        this._spacingExpr[index] = this._spacingVars[index].multiply(-1);
                    }
                    this._solver.suggestValue(this._spacingVars[index], this._spacing[index]);
                }
                return this._spacingExpr[index];
            }

            function _addConstraint(constraint) {
                //this.constraints.push(constraint);
                var relation = void 0;
                var multiplier = constraint.multiplier !== undefined ? constraint.multiplier : 1;
                var constant = constraint.constant !== undefined ? constraint.constant : 0;
                if (constant === 'default') {
                    constant = _getSpacing.call(this, constraint);
                }
                var attr1 = _getSubView.call(this, constraint.view1)._getAttr(constraint.attr1);
                var attr2 = void 0;
                if (true) {
                    if (constraint.attr2 === Attribute.CONST) {
                        attr2 = _getConst.call(this, undefined, constraint.constant);
                    } else {
                        attr2 = _getSubView.call(this, constraint.view2)._getAttr(constraint.attr2);
                        if (multiplier !== 1 && constant) {
                            attr2 = c.plus(c.times(attr2, multiplier), constant);
                        } else if (constant) {
                            attr2 = c.plus(attr2, constant);
                        } else if (multiplier !== 1) {
                            attr2 = c.times(attr2, multiplier);
                        }
                    }
                    var strength = constraint.priority !== undefined && constraint.priority < 1000 ? new c.Strength('priority', 0, constraint.priority, 1000) : defaultPriorityStrength;
                    switch (constraint.relation) {
                        case Relation.EQU:
                            relation = new c.Equation(attr1, attr2, strength);
                            break;
                        case Relation.GEQ:
                            relation = new c.Inequality(attr1, c.GEQ, attr2, strength);
                            break;
                        case Relation.LEQ:
                            relation = new c.Inequality(attr1, c.LEQ, attr2, strength);
                            break;
                        default:
                            throw 'Invalid relation specified: ' + constraint.relation;
                    }
                } else {
                    if (constraint.attr2 === Attribute.CONST) {
                        attr2 = _getConst.call(this, undefined, constraint.constant);
                    } else {
                        attr2 = _getSubView.call(this, constraint.view2)._getAttr(constraint.attr2);
                        if (multiplier !== 1 && constant) {
                            attr2 = attr2.multiply(multiplier).plus(constant);
                        } else if (constant) {
                            attr2 = attr2.plus(constant);
                        } else if (multiplier !== 1) {
                            attr2 = attr2.multiply(multiplier);
                        }
                    }
                    var _strength = constraint.priority !== undefined && constraint.priority < 1000 ? kiwi.Strength.create(0, constraint.priority, 1000) : defaultPriorityStrength;
                    switch (constraint.relation) {
                        case Relation.EQU:
                            relation = new kiwi.Constraint(attr1, kiwi.Operator.Eq, attr2, _strength);
                            break;
                        case Relation.GEQ:
                            relation = new kiwi.Constraint(attr1, kiwi.Operator.Ge, attr2, _strength);
                            break;
                        case Relation.LEQ:
                            relation = new kiwi.Constraint(attr1, kiwi.Operator.Le, attr2, _strength);
                            break;
                        default:
                            throw 'Invalid relation specified: ' + constraint.relation;
                    }
                }
                this._solver.addConstraint(relation);
            }

            function _compareSpacing(old, newz) {
                if (old === newz) {
                    return true;
                }
                if (!old || !newz) {
                    return false;
                }
                for (var i = 0; i < 7; i++) {
                    if (old[i] !== newz[i]) {
                        return false;
                    }
                }
                return true;
            }

            /**
             * AutoLayoutJS API reference.
             *
             * ### Index
             *
             * |Entity|Type|Description|
             * |---|---|---|
             * |[AutoLayout](#autolayout)|`namespace`|Top level AutoLayout object.|
             * |[VisualFormat](#autolayoutvisualformat--object)|`namespace`|Parses VFL into constraints.|
             * |[View](#autolayoutview)|`class`|Main entity for adding & evaluating constraints.|
             * |[SubView](#autolayoutsubview--object)|`class`|SubView's are automatically created when constraints are added to views. They give access to the evaluated results.|
             * |[Attribute](#autolayoutattribute--enum)|`enum`|Attribute types that are supported when adding constraints.|
             * |[Relation](#autolayoutrelation--enum)|`enum`|Relationship types that are supported when adding constraints.|
             * |[Priority](#autolayoutpriority--enum)|`enum`|Default priority values for when adding constraints.|
             *
             * ### AutoLayout
             *
             * @module AutoLayout
             */

            var View = function () {

                /**
                 * @class View
                 * @param {Object} [options] Configuration options.
                 * @param {Number} [options.width] Initial width of the view.
                 * @param {Number} [options.height] Initial height of the view.
                 * @param {Number|Object} [options.spacing] Spacing for the view (default: 8) (see `setSpacing`).
                 * @param {Array} [options.constraints] One or more constraint definitions (see `addConstraints`).
                 */
                function View(options) {
                    _classCallCheck(this, View);

                    this._solver = true ? new c.SimplexSolver() : new kiwi.Solver();
                    this._subViews = {};
                    //this._spacing = undefined;
                    this._parentSubView = new SubView({
                        solver: this._solver
                    });
                    this.setSpacing(options && options.spacing !== undefined ? options.spacing : 8);
                    //this.constraints = [];
                    if (options) {
                        if (options.width !== undefined || options.height !== undefined) {
                            this.setSize(options.width, options.height);
                        }
                        if (options.constraints) {
                            this.addConstraints(options.constraints);
                        }
                    }
                }

                /**
                 * Sets the width and height of the view.
                 *
                 * @param {Number} width Width of the view.
                 * @param {Number} height Height of the view.
                 * @return {View} this
                 */


                _createClass(View, [{
                    key: 'setSize',
                    value: function setSize(width, height /*, depth*/) {
                        this._parentSubView.intrinsicWidth = width;
                        this._parentSubView.intrinsicHeight = height;
                        return this;
                    }

                    /**
                     * Width that was set using `setSize`.
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'setSpacing',


                    /**
                     * Sets the spacing for the view.
                     *
                     * The spacing can be set for 7 different variables:
                     * `top`, `right`, `bottom`, `left`, `width`, `height` and `zIndex`. The `left`-spacing is
                     * used when a spacer is used between the parent-view and a sub-view (e.g. `|-[subView]`).
                     * The same is true for the `right`, `top` and `bottom` spacers. The `width` and `height` are
                     * used for spacers in between sub-views (e.g. `[view1]-[view2]`).
                     *
                     * Instead of using the full spacing syntax, it is also possible to use shorthand notations:
                     *
                     * |Syntax|Type|Description|
                     * |---|---|---|
                     * |`[top, right, bottom, left, width, height, zIndex]`|Array(7)|Full syntax including z-index **(clockwise order)**.|
                     * |`[top, right, bottom, left, width, height]`|Array(6)|Full horizontal & vertical spacing syntax (no z-index) **(clockwise order)**.|
                     * |`[horizontal, vertical, zIndex]`|Array(3)|Horizontal = left, right, width, vertical = top, bottom, height.|
                     * |`[horizontal, vertical]`|Array(2)|Horizontal = left, right, width, vertical = top, bottom, height, z-index = 1.|
                     * |`spacing`|Number|Horizontal & vertical spacing are all the same, z-index = 1.|
                     *
                     * Examples:
                     * ```javascript
                     * view.setSpacing(10); // horizontal & vertical spacing 10
                     * view.setSpacing([10, 15, 2]); // horizontal spacing 10, vertical spacing 15, z-axis spacing 2
                     * view.setSpacing([10, 20, 10, 20, 5, 5]); // top, right, bottom, left, horizontal, vertical
                     * view.setSpacing([10, 20, 10, 20, 5, 5, 1]); // top, right, bottom, left, horizontal, vertical, z
                     * ```
                     *
                     * @param {Number|Array} spacing
                     * @return {View} this
                     */
                    value: function setSpacing(spacing) {
                        // convert spacing into array: [top, right, bottom, left, horz, vert, z-index]
                        switch (Array.isArray(spacing) ? spacing.length : -1) {
                            case -1:
                                spacing = [spacing, spacing, spacing, spacing, spacing, spacing, 1];
                                break;
                            case 1:
                                spacing = [spacing[0], spacing[0], spacing[0], spacing[0], spacing[0], spacing[0], 1];
                                break;
                            case 2:
                                spacing = [spacing[1], spacing[0], spacing[1], spacing[0], spacing[0], spacing[1], 1];
                                break;
                            case 3:
                                spacing = [spacing[1], spacing[0], spacing[1], spacing[0], spacing[0], spacing[1], spacing[2]];
                                break;
                            case 6:
                                spacing = [spacing[0], spacing[1], spacing[2], spacing[3], spacing[4], spacing[5], 1];
                                break;
                            case 7:
                                break;
                            default:
                                throw 'Invalid spacing syntax';
                        }
                        if (!_compareSpacing(this._spacing, spacing)) {
                            this._spacing = spacing;
                            // update spacing variables
                            if (this._spacingVars) {
                                for (var i = 0; i < this._spacingVars.length; i++) {
                                    if (this._spacingVars[i]) {
                                        this._solver.suggestValue(this._spacingVars[i], this._spacing[i]);
                                    }
                                }
                                if (true) {
                                    this._solver.resolve();
                                } else {
                                    this._solver.updateVariables();
                                }
                            }
                        }
                        return this;
                    }

                    /**
                     * Adds a constraint definition.
                     *
                     * A constraint definition has the following format:
                     *
                     * ```javascript
                     * constraint: {
                     *   view1: {String},
                     *   attr1: {AutoLayout.Attribute},
                     *   relation: {AutoLayout.Relation},
                     *   view2: {String},
                     *   attr2: {AutoLayout.Attribute},
                     *   multiplier: {Number},
                     *   constant: {Number},
                     *   priority: {Number}(0..1000)
                     * }
                     * ```
                     * @param {Object} constraint Constraint definition.
                     * @return {View} this
                     */

                }, {
                    key: 'addConstraint',
                    value: function addConstraint(constraint) {
                        _addConstraint.call(this, constraint);
                        if (!true) {
                            this._solver.updateVariables();
                        }
                        return this;
                    }

                    /**
                     * Adds one or more constraint definitions.
                     *
                     * A constraint definition has the following format:
                     *
                     * ```javascript
                     * constraint: {
                     *   view1: {String},
                     *   attr1: {AutoLayout.Attribute},
                     *   relation: {AutoLayout.Relation},
                     *   view2: {String},
                     *   attr2: {AutoLayout.Attribute},
                     *   multiplier: {Number},
                     *   constant: {Number},
                     *   priority: {Number}(0..1000)
                     * }
                     * ```
                     * @param {Array} constraints One or more constraint definitions.
                     * @return {View} this
                     */

                }, {
                    key: 'addConstraints',
                    value: function addConstraints(constraints) {
                        for (var j = 0; j < constraints.length; j++) {
                            _addConstraint.call(this, constraints[j]);
                        }
                        if (!true) {
                            this._solver.updateVariables();
                        }
                        return this;
                    }

                    /**
                     * Dictionary of `SubView` objects that have been created when adding constraints.
                     * @readonly
                     * @type {Object.SubView}
                     */

                }, {
                    key: 'width',
                    get: function get() {
                        return this._parentSubView.intrinsicWidth;
                    }

                    /**
                     * Height that was set using `setSize`.
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'height',
                    get: function get() {
                        return this._parentSubView.intrinsicHeight;
                    }

                    /**
                     * Width that is calculated from the constraints and the `.intrinsicWidth` of
                     * the sub-views.
                     *
                     * When the width has been explicitely set using `setSize`, the fittingWidth
                     * will **always** be the same as the explicitely set width. To calculate the size
                     * based on the content, use:
                     * ```javascript
                     * var view = new AutoLayout.View({
                     *   constraints: VisualFormat.parse('|-[view1]-[view2]-'),
                     *   spacing: 20
                     * });
                     * view.subViews.view1.intrinsicWidth = 100;
                     * view.subViews.view2.intrinsicWidth = 100;
                     * console.log('fittingWidth: ' + view.fittingWidth); // 260
                     * ```
                     *
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'fittingWidth',
                    get: function get() {
                        return this._parentSubView.width;
                    }

                    /**
                     * Height that is calculated from the constraints and the `.intrinsicHeight` of
                     * the sub-views.
                     *
                     * See `.fittingWidth`.
                     *
                     * @readonly
                     * @type {Number}
                     */

                }, {
                    key: 'fittingHeight',
                    get: function get() {
                        return this._parentSubView.height;
                    }
                }, {
                    key: 'subViews',
                    get: function get() {
                        return this._subViews;
                    }

                    /**
                     * Checks whether the constraints incompletely specify the location
                     * of the subViews.
                     * @private
                     */
                    //get hasAmbiguousLayout() {
                    // Todo
                    //}

                }]);

                return View;
            }();

//import DOM from './DOM';

            /**
             * AutoLayout.
             *
             * @namespace AutoLayout
             * @property {Attribute} Attribute
             * @property {Relation} Relation
             * @property {Priority} Priority
             * @property {VisualFormat} VisualFormat
             * @property {View} View
             * @property {SubView} SubView
             */


            var AutoLayout = {
                Attribute: Attribute,
                Relation: Relation,
                Priority: Priority,
                VisualFormat: VisualFormat,
                View: View,
                SubView: SubView
                //DOM: DOM
            };

            module.exports = AutoLayout;

        }, {"cassowary/bin/c": 2}], 2: [function (require, module, exports) {
            /**
             * Parts Copyright (C) 2011-2012, Alex Russell (slightlyoff@chromium.org)
             * Parts Copyright (C) Copyright (C) 1998-2000 Greg J. Badros
             *
             * Use of this source code is governed by the LGPL, which can be found in the
             * COPYING.LGPL file.
             *
             * This is a compiled version of Cassowary/JS. For source versions or to
             * contribute, see the github project:
             *
             *  https://github.com/slightlyoff/cassowary-js-refactor
             *
             */

            (function () {
                (function (a) {
                    "use strict";
                    try {
                        (function () {
                        }).bind(a)
                    } catch (b) {
                        Object.defineProperty(Function.prototype, "bind", {
                            value: function (a) {
                                var b = this;
                                return function () {
                                    return b.apply(a, arguments)
                                }
                            }, enumerable: !1, configurable: !0, writable: !0
                        })
                    }
                    var c = a.HTMLElement !== void 0, d = function (a) {
                        for (var b = null; a && a != Object.prototype;) {
                            if (a.tagName) {
                                b = a.tagName;
                                break
                            }
                            a = a.prototype
                        }
                        return b || "div"
                    }, e = 1e-8, f = {}, g = function (a, b) {
                        if (a && b) {
                            if ("function" == typeof a[b]) return a[b];
                            var c = a.prototype;
                            if (c && "function" == typeof c[b]) return c[b];
                            if (c !== Object.prototype && c !== Function.prototype) return "function" == typeof a.__super__ ? g(a.__super__, b) : void 0
                        }
                    }, h = a.c = {
                        debug: !1,
                        trace: !1,
                        verbose: !1,
                        traceAdded: !1,
                        GC: !1,
                        GEQ: 1,
                        LEQ: 2,
                        inherit: function (b) {
                            var e = null, g = null;
                            b["extends"] && (g = b["extends"], delete b["extends"]), b.initialize && (e = b.initialize, delete b.initialize);
                            var h = e || function () {
                            };
                            Object.defineProperty(h, "__super__", {
                                value: g ? g : Object,
                                enumerable: !1,
                                configurable: !0,
                                writable: !1
                            }), b._t && (f[b._t] = h);
                            var i = h.prototype = Object.create(g ? g.prototype : Object.prototype);
                            if (this.extend(i, b), c && g && g.prototype instanceof a.HTMLElement) {
                                var j = h, k = d(i), l = function (a) {
                                    return a.__proto__ = i, j.apply(a, arguments), i.created && a.created(), i.decorate && a.decorate(), a
                                };
                                this.extend(i, {upgrade: l}), h = function () {
                                    return l(a.document.createElement(k))
                                }, h.prototype = i, this.extend(h, {ctor: j})
                            }
                            return h
                        },
                        extend: function (a, b) {
                            return this.own(b, function (c) {
                                var d = Object.getOwnPropertyDescriptor(b, c);
                                try {
                                    "function" == typeof d.get || "function" == typeof d.set ? Object.defineProperty(a, c, d) : "function" == typeof d.value || "_" === c.charAt(0) ? (d.writable = !0, d.configurable = !0, d.enumerable = !1, Object.defineProperty(a, c, d)) : a[c] = b[c]
                                } catch (e) {
                                }
                            }), a
                        },
                        own: function (b, c, d) {
                            return Object.getOwnPropertyNames(b).forEach(c, d || a), b
                        },
                        traceprint: function (a) {
                            h.verbose && console.log(a)
                        },
                        fnenterprint: function (a) {
                            console.log("* " + a)
                        },
                        fnexitprint: function (a) {
                            console.log("- " + a)
                        },
                        assert: function (a, b) {
                            if (!a) throw new h.InternalError("Assertion failed: " + b)
                        },
                        plus: function (a, b) {
                            return a instanceof h.Expression || (a = new h.Expression(a)), b instanceof h.Expression || (b = new h.Expression(b)), a.plus(b)
                        },
                        minus: function (a, b) {
                            return a instanceof h.Expression || (a = new h.Expression(a)), b instanceof h.Expression || (b = new h.Expression(b)), a.minus(b)
                        },
                        times: function (a, b) {
                            return ("number" == typeof a || a instanceof h.Variable) && (a = new h.Expression(a)), ("number" == typeof b || b instanceof h.Variable) && (b = new h.Expression(b)), a.times(b)
                        },
                        divide: function (a, b) {
                            return ("number" == typeof a || a instanceof h.Variable) && (a = new h.Expression(a)), ("number" == typeof b || b instanceof h.Variable) && (b = new h.Expression(b)), a.divide(b)
                        },
                        approx: function (a, b) {
                            if (a === b) return !0;
                            var c, d;
                            return c = a instanceof h.Variable ? a.value : a, d = b instanceof h.Variable ? b.value : b, 0 == c ? e > Math.abs(d) : 0 == d ? e > Math.abs(c) : Math.abs(c - d) < Math.abs(c) * e
                        },
                        _inc: function (a) {
                            return function () {
                                return a++
                            }
                        }(0),
                        parseJSON: function (a) {
                            return JSON.parse(a, function (a, b) {
                                if ("object" != typeof b || "string" != typeof b._t) return b;
                                var c = b._t, d = f[c];
                                if (c && d) {
                                    var e = g(d, "fromJSON");
                                    if (e) return e(b, d)
                                }
                                return b
                            })
                        }
                    };
                    "function" == typeof require && "undefined" != typeof module && "undefined" == typeof load && (a.exports = h)
                })(this), function (a) {
                    "use strict";
                    var b = function (a) {
                        var b = a.hashCode ? a.hashCode : "" + a;
                        return b
                    }, c = function (a, b) {
                        Object.keys(a).forEach(function (c) {
                            b[c] = a[c]
                        })
                    }, d = {};
                    a.HashTable = a.inherit({
                        initialize: function () {
                            this.size = 0, this._store = {}, this._keyStrMap = {}, this._deleted = 0
                        }, set: function (a, c) {
                            var d = b(a);
                            this._store.hasOwnProperty(d) || this.size++, this._store[d] = c, this._keyStrMap[d] = a
                        }, get: function (a) {
                            if (!this.size) return null;
                            a = b(a);
                            var c = this._store[a];
                            return c !== void 0 ? this._store[a] : null
                        }, clear: function () {
                            this.size = 0, this._store = {}, this._keyStrMap = {}
                        }, _compact: function () {
                            var a = {};
                            c(this._store, a), this._store = a
                        }, _compactThreshold: 100, _perhapsCompact: function () {
                            this._size > 64 || this._deleted > this._compactThreshold && (this._compact(), this._deleted = 0)
                        }, "delete": function (a) {
                            a = b(a), this._store.hasOwnProperty(a) && (this._deleted++, delete this._store[a], this.size > 0 && this.size--)
                        }, each: function (a, b) {
                            if (this.size) {
                                this._perhapsCompact();
                                var c = this._store, d = this._keyStrMap;
                                Object.keys(this._store).forEach(function (e) {
                                    a.call(b || null, d[e], c[e])
                                }, this)
                            }
                        }, escapingEach: function (a, b) {
                            if (this.size) {
                                this._perhapsCompact();
                                for (var c = this, e = this._store, f = this._keyStrMap, g = d, h = Object.keys(e), i = 0; h.length > i; i++) if (function (d) {
                                    c._store.hasOwnProperty(d) && (g = a.call(b || null, f[d], e[d]))
                                }(h[i]), g) {
                                    if (void 0 !== g.retval) return g;
                                    if (g.brk) break
                                }
                            }
                        }, clone: function () {
                            var b = new a.HashTable;
                            return this.size && (b.size = this.size, c(this._store, b._store), c(this._keyStrMap, b._keyStrMap)), b
                        }, equals: function (b) {
                            if (b === this) return !0;
                            if (!(b instanceof a.HashTable) || b._size !== this._size) return !1;
                            for (var c = Object.keys(this._store), d = 0; c.length > d; d++) {
                                var e = c[d];
                                if (this._keyStrMap[e] !== b._keyStrMap[e] || this._store[e] !== b._store[e]) return !1
                            }
                            return !0
                        }, toString: function () {
                            var b = "";
                            return this.each(function (a, c) {
                                b += a + " => " + c + "\n"
                            }), b
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.HashSet = a.inherit({
                        _t: "c.HashSet", initialize: function () {
                            this.storage = [], this.size = 0
                        }, add: function (a) {
                            var b = this.storage;
                            b.indexOf(a), -1 == b.indexOf(a) && b.push(a), this.size = this.storage.length
                        }, values: function () {
                            return this.storage
                        }, has: function (a) {
                            var b = this.storage;
                            return -1 != b.indexOf(a)
                        }, "delete": function (a) {
                            var b = this.storage.indexOf(a);
                            return -1 == b ? null : (this.storage.splice(b, 1)[0], this.size = this.storage.length, void 0)
                        }, clear: function () {
                            this.storage.length = 0
                        }, each: function (a, b) {
                            this.size && this.storage.forEach(a, b)
                        }, escapingEach: function (a, b) {
                            this.size && this.storage.forEach(a, b)
                        }, toString: function () {
                            var a = this.size + " {", b = !0;
                            return this.each(function (c) {
                                b ? b = !1 : a += ", ", a += c
                            }), a += "}\n"
                        }, toJSON: function () {
                            var a = [];
                            return this.each(function (b) {
                                a.push(b.toJSON())
                            }), {_t: "c.HashSet", data: a}
                        }, fromJSON: function (b) {
                            var c = new a.HashSet;
                            return b.data && (c.size = b.data.length, c.storage = b.data), c
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.Error = a.inherit({
                        initialize: function (a) {
                            a && (this._description = a)
                        }, _name: "c.Error", _description: "An error has occured in Cassowary", set description(a) {
                            this._description = a
                        }, get description() {
                            return "(" + this._name + ") " + this._description
                        }, get message() {
                            return this.description
                        }, toString: function () {
                            return this.description
                        }
                    });
                    var b = function (b, c) {
                        return a.inherit({
                            "extends": a.Error, initialize: function () {
                                a.Error.apply(this, arguments)
                            }, _name: b || "", _description: c || ""
                        })
                    };
                    a.ConstraintNotFound = b("c.ConstraintNotFound", "Tried to remove a constraint never added to the tableu"), a.InternalError = b("c.InternalError"), a.NonExpression = b("c.NonExpression", "The resulting expression would be non"), a.NotEnoughStays = b("c.NotEnoughStays", "There are not enough stays to give specific values to every variable"), a.RequiredFailure = b("c.RequiredFailure", "A required constraint cannot be satisfied"), a.TooDifficult = b("c.TooDifficult", "The constraints are too difficult to solve")
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    var b = 1e3;
                    a.SymbolicWeight = a.inherit({
                        _t: "c.SymbolicWeight", initialize: function () {
                            this.value = 0;
                            for (var a = 1, c = arguments.length - 1; c >= 0; --c) this.value += arguments[c] * a, a *= b
                        }, toJSON: function () {
                            return {_t: this._t, value: this.value}
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    a.Strength = a.inherit({
                        initialize: function (b, c, d, e) {
                            this.name = b, this.symbolicWeight = c instanceof a.SymbolicWeight ? c : new a.SymbolicWeight(c, d, e)
                        }, get required() {
                            return this === a.Strength.required
                        }, toString: function () {
                            return this.name + (this.isRequired ? "" : ":" + this.symbolicWeight)
                        }
                    }), a.Strength.required = new a.Strength("<Required>", 1e3, 1e3, 1e3), a.Strength.strong = new a.Strength("strong", 1, 0, 0), a.Strength.medium = new a.Strength("medium", 0, 1, 0), a.Strength.weak = new a.Strength("weak", 0, 0, 1)
                }(this.c || ("undefined" != typeof module ? module.parent.exports.c : {})), function (a) {
                    "use strict";
                    a.AbstractVariable = a.inherit({
                        isDummy: !1,
                        isExternal: !1,
                        isPivotable: !1,
                        isRestricted: !1,
                        _init: function (b, c) {
                            this.hashCode = a._inc(), this.name = (c || "") + this.hashCode, b && (b.name !== void 0 && (this.name = b.name), b.value !== void 0 && (this.value = b.value), b.prefix !== void 0 && (this._prefix = b.prefix))
                        },
                        _prefix: "",
                        name: "",
                        value: 0,
                        toJSON: function () {
                            var a = {};
                            return this._t && (a._t = this._t), this.name && (a.name = this.name), this.value !== void 0 && (a.value = this.value), this._prefix && (a._prefix = this._prefix), this._t && (a._t = this._t), a
                        },
                        fromJSON: function (b, c) {
                            var d = new c;
                            return a.extend(d, b), d
                        },
                        toString: function () {
                            return this._prefix + "[" + this.name + ":" + this.value + "]"
                        }
                    }), a.Variable = a.inherit({
                        _t: "c.Variable",
                        "extends": a.AbstractVariable,
                        initialize: function (b) {
                            this._init(b, "v");
                            var c = a.Variable._map;
                            c && (c[this.name] = this)
                        },
                        isExternal: !0
                    }), a.DummyVariable = a.inherit({
                        _t: "c.DummyVariable",
                        "extends": a.AbstractVariable,
                        initialize: function (a) {
                            this._init(a, "d")
                        },
                        isDummy: !0,
                        isRestricted: !0,
                        value: "dummy"
                    }), a.ObjectiveVariable = a.inherit({
                        _t: "c.ObjectiveVariable",
                        "extends": a.AbstractVariable,
                        initialize: function (a) {
                            this._init(a, "o")
                        },
                        value: "obj"
                    }), a.SlackVariable = a.inherit({
                        _t: "c.SlackVariable",
                        "extends": a.AbstractVariable,
                        initialize: function (a) {
                            this._init(a, "s")
                        },
                        isPivotable: !0,
                        isRestricted: !0,
                        value: "slack"
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.Point = a.inherit({
                        initialize: function (b, c, d) {
                            if (b instanceof a.Variable) this._x = b; else {
                                var e = {value: b};
                                d && (e.name = "x" + d), this._x = new a.Variable(e)
                            }
                            if (c instanceof a.Variable) this._y = c; else {
                                var f = {value: c};
                                d && (f.name = "y" + d), this._y = new a.Variable(f)
                            }
                        }, get x() {
                            return this._x
                        }, set x(b) {
                            b instanceof a.Variable ? this._x = b : this._x.value = b
                        }, get y() {
                            return this._y
                        }, set y(b) {
                            b instanceof a.Variable ? this._y = b : this._y.value = b
                        }, toString: function () {
                            return "(" + this.x + ", " + this.y + ")"
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.Expression = a.inherit({
                        initialize: function (b, c, d) {
                            a.GC && console.log("new c.Expression"), this.constant = "number" != typeof d || isNaN(d) ? 0 : d, this.terms = new a.HashTable, b instanceof a.AbstractVariable ? this.setVariable(b, "number" == typeof c ? c : 1) : "number" == typeof b && (isNaN(b) ? console.trace() : this.constant = b)
                        }, initializeFromHash: function (b, c) {
                            return a.verbose && (console.log("*******************************"), console.log("clone c.initializeFromHash"), console.log("*******************************")), a.GC && console.log("clone c.Expression"), this.constant = b, this.terms = c.clone(), this
                        }, multiplyMe: function (a) {
                            this.constant *= a;
                            var b = this.terms;
                            return b.each(function (c, d) {
                                b.set(c, d * a)
                            }), this
                        }, clone: function () {
                            a.verbose && (console.log("*******************************"), console.log("clone c.Expression"), console.log("*******************************"));
                            var b = new a.Expression;
                            return b.initializeFromHash(this.constant, this.terms), b
                        }, times: function (b) {
                            if ("number" == typeof b) return this.clone().multiplyMe(b);
                            if (this.isConstant) return b.times(this.constant);
                            if (b.isConstant) return this.times(b.constant);
                            throw new a.NonExpression
                        }, plus: function (b) {
                            return b instanceof a.Expression ? this.clone().addExpression(b, 1) : b instanceof a.Variable ? this.clone().addVariable(b, 1) : void 0
                        }, minus: function (b) {
                            return b instanceof a.Expression ? this.clone().addExpression(b, -1) : b instanceof a.Variable ? this.clone().addVariable(b, -1) : void 0
                        }, divide: function (b) {
                            if ("number" == typeof b) {
                                if (a.approx(b, 0)) throw new a.NonExpression;
                                return this.times(1 / b)
                            }
                            if (b instanceof a.Expression) {
                                if (!b.isConstant) throw new a.NonExpression;
                                return this.times(1 / b.constant)
                            }
                        }, addExpression: function (b, c, d, e) {
                            return b instanceof a.AbstractVariable && (b = new a.Expression(b), a.trace && console.log("addExpression: Had to cast a var to an expression")), c = c || 1, this.constant += c * b.constant, b.terms.each(function (a, b) {
                                this.addVariable(a, b * c, d, e)
                            }, this), this
                        }, addVariable: function (b, c, d, e) {
                            null == c && (c = 1), a.trace && console.log("c.Expression::addVariable():", b, c);
                            var f = this.terms.get(b);
                            if (f) {
                                var g = f + c;
                                0 == g || a.approx(g, 0) ? (e && e.noteRemovedVariable(b, d), this.terms.delete(b)) : this.setVariable(b, g)
                            } else a.approx(c, 0) || (this.setVariable(b, c), e && e.noteAddedVariable(b, d));
                            return this
                        }, setVariable: function (a, b) {
                            return this.terms.set(a, b), this
                        }, anyPivotableVariable: function () {
                            if (this.isConstant) throw new a.InternalError("anyPivotableVariable called on a constant");
                            var b = this.terms.escapingEach(function (a) {
                                return a.isPivotable ? {retval: a} : void 0
                            });
                            return b && void 0 !== b.retval ? b.retval : null
                        }, substituteOut: function (b, c, d, e) {
                            a.trace && (a.fnenterprint("CLE:substituteOut: " + b + ", " + c + ", " + d + ", ..."), a.traceprint("this = " + this));
                            var f = this.setVariable.bind(this), g = this.terms, h = g.get(b);
                            g.delete(b), this.constant += h * c.constant, c.terms.each(function (b, c) {
                                var i = g.get(b);
                                if (i) {
                                    var j = i + h * c;
                                    a.approx(j, 0) ? (e.noteRemovedVariable(b, d), g.delete(b)) : f(b, j)
                                } else f(b, h * c), e && e.noteAddedVariable(b, d)
                            }), a.trace && a.traceprint("Now this is " + this)
                        }, changeSubject: function (a, b) {
                            this.setVariable(a, this.newSubject(b))
                        }, newSubject: function (b) {
                            a.trace && a.fnenterprint("newSubject:" + b);
                            var c = 1 / this.terms.get(b);
                            return this.terms.delete(b), this.multiplyMe(-c), c
                        }, coefficientFor: function (a) {
                            return this.terms.get(a) || 0
                        }, get isConstant() {
                            return 0 == this.terms.size
                        }, toString: function () {
                            var b = "", c = !1;
                            if (!a.approx(this.constant, 0) || this.isConstant) {
                                if (b += this.constant, this.isConstant) return b;
                                c = !0
                            }
                            return this.terms.each(function (a, d) {
                                c && (b += " + "), b += d + "*" + a, c = !0
                            }), b
                        }, equals: function (b) {
                            return b === this ? !0 : b instanceof a.Expression && b.constant === this.constant && b.terms.equals(this.terms)
                        }, Plus: function (a, b) {
                            return a.plus(b)
                        }, Minus: function (a, b) {
                            return a.minus(b)
                        }, Times: function (a, b) {
                            return a.times(b)
                        }, Divide: function (a, b) {
                            return a.divide(b)
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.AbstractConstraint = a.inherit({
                        initialize: function (b, c) {
                            this.hashCode = a._inc(), this.strength = b || a.Strength.required, this.weight = c || 1
                        }, isEditConstraint: !1, isInequality: !1, isStayConstraint: !1, get required() {
                            return this.strength === a.Strength.required
                        }, toString: function () {
                            return this.strength + " {" + this.weight + "} (" + this.expression + ")"
                        }
                    });
                    var b = a.AbstractConstraint.prototype.toString, c = function (b, c, d) {
                        a.AbstractConstraint.call(this, c || a.Strength.strong, d), this.variable = b, this.expression = new a.Expression(b, -1, b.value)
                    };
                    a.EditConstraint = a.inherit({
                        "extends": a.AbstractConstraint, initialize: function () {
                            c.apply(this, arguments)
                        }, isEditConstraint: !0, toString: function () {
                            return "edit:" + b.call(this)
                        }
                    }), a.StayConstraint = a.inherit({
                        "extends": a.AbstractConstraint, initialize: function () {
                            c.apply(this, arguments)
                        }, isStayConstraint: !0, toString: function () {
                            return "stay:" + b.call(this)
                        }
                    });
                    var d = a.Constraint = a.inherit({
                        "extends": a.AbstractConstraint, initialize: function (b, c, d) {
                            a.AbstractConstraint.call(this, c, d), this.expression = b
                        }
                    });
                    a.Inequality = a.inherit({
                        "extends": a.Constraint, _cloneOrNewCle: function (b) {
                            return b.clone ? b.clone() : new a.Expression(b)
                        }, initialize: function (b, c, e, f, g) {
                            var h = b instanceof a.Expression, i = e instanceof a.Expression,
                                j = b instanceof a.AbstractVariable, k = e instanceof a.AbstractVariable,
                                l = "number" == typeof b, m = "number" == typeof e;
                            if ((h || l) && k) {
                                var n = b, o = c, p = e, q = f, r = g;
                                if (d.call(this, this._cloneOrNewCle(n), q, r), o == a.LEQ) this.expression.multiplyMe(-1), this.expression.addVariable(p); else {
                                    if (o != a.GEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                    this.expression.addVariable(p, -1)
                                }
                            } else if (j && (i || m)) {
                                var n = e, o = c, p = b, q = f, r = g;
                                if (d.call(this, this._cloneOrNewCle(n), q, r), o == a.GEQ) this.expression.multiplyMe(-1), this.expression.addVariable(p); else {
                                    if (o != a.LEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                    this.expression.addVariable(p, -1)
                                }
                            } else {
                                if (h && m) {
                                    var s = b, o = c, t = e, q = f, r = g;
                                    if (d.call(this, this._cloneOrNewCle(s), q, r), o == a.LEQ) this.expression.multiplyMe(-1), this.expression.addExpression(this._cloneOrNewCle(t)); else {
                                        if (o != a.GEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                        this.expression.addExpression(this._cloneOrNewCle(t), -1)
                                    }
                                    return this
                                }
                                if (l && i) {
                                    var s = e, o = c, t = b, q = f, r = g;
                                    if (d.call(this, this._cloneOrNewCle(s), q, r), o == a.GEQ) this.expression.multiplyMe(-1), this.expression.addExpression(this._cloneOrNewCle(t)); else {
                                        if (o != a.LEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                        this.expression.addExpression(this._cloneOrNewCle(t), -1)
                                    }
                                    return this
                                }
                                if (h && i) {
                                    var s = b, o = c, t = e, q = f, r = g;
                                    if (d.call(this, this._cloneOrNewCle(t), q, r), o == a.GEQ) this.expression.multiplyMe(-1), this.expression.addExpression(this._cloneOrNewCle(s)); else {
                                        if (o != a.LEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                        this.expression.addExpression(this._cloneOrNewCle(s), -1)
                                    }
                                } else {
                                    if (h) return d.call(this, b, c, e);
                                    if (c == a.GEQ) d.call(this, new a.Expression(e), f, g), this.expression.multiplyMe(-1), this.expression.addVariable(b); else {
                                        if (c != a.LEQ) throw new a.InternalError("Invalid operator in c.Inequality constructor");
                                        d.call(this, new a.Expression(e), f, g), this.expression.addVariable(b, -1)
                                    }
                                }
                            }
                        }, isInequality: !0, toString: function () {
                            return d.prototype.toString.call(this) + " >= 0) id: " + this.hashCode
                        }
                    }), a.Equation = a.inherit({
                        "extends": a.Constraint, initialize: function (b, c, e, f) {
                            if (b instanceof a.Expression && !c || c instanceof a.Strength) d.call(this, b, c, e); else if (b instanceof a.AbstractVariable && c instanceof a.Expression) {
                                var g = b, h = c, i = e, j = f;
                                d.call(this, h.clone(), i, j), this.expression.addVariable(g, -1)
                            } else if (b instanceof a.AbstractVariable && "number" == typeof c) {
                                var g = b, k = c, i = e, j = f;
                                d.call(this, new a.Expression(k), i, j), this.expression.addVariable(g, -1)
                            } else if (b instanceof a.Expression && c instanceof a.AbstractVariable) {
                                var h = b, g = c, i = e, j = f;
                                d.call(this, h.clone(), i, j), this.expression.addVariable(g, -1)
                            } else {
                                if (!(b instanceof a.Expression || b instanceof a.AbstractVariable || "number" == typeof b) || !(c instanceof a.Expression || c instanceof a.AbstractVariable || "number" == typeof c)) throw"Bad initializer to c.Equation";
                                b = b instanceof a.Expression ? b.clone() : new a.Expression(b), c = c instanceof a.Expression ? c.clone() : new a.Expression(c), d.call(this, b, e, f), this.expression.addExpression(c, -1)
                            }
                            a.assert(this.strength instanceof a.Strength, "_strength not set")
                        }, toString: function () {
                            return d.prototype.toString.call(this) + " = 0)"
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.EditInfo = a.inherit({
                        initialize: function (a, b, c, d, e) {
                            this.constraint = a, this.editPlus = b, this.editMinus = c, this.prevEditConstant = d, this.index = e
                        }, toString: function () {
                            return "<cn=" + this.constraint + ", ep=" + this.editPlus + ", em=" + this.editMinus + ", pec=" + this.prevEditConstant + ", index=" + this.index + ">"
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.Tableau = a.inherit({
                        initialize: function () {
                            this.columns = new a.HashTable, this.rows = new a.HashTable, this._infeasibleRows = new a.HashSet, this._externalRows = new a.HashSet, this._externalParametricVars = new a.HashSet
                        }, noteRemovedVariable: function (b, c) {
                            a.trace && console.log("c.Tableau::noteRemovedVariable: ", b, c);
                            var d = this.columns.get(b);
                            c && d && d.delete(c)
                        }, noteAddedVariable: function (a, b) {
                            b && this.insertColVar(a, b)
                        }, getInternalInfo: function () {
                            var a = "Tableau Information:\n";
                            return a += "Rows: " + this.rows.size, a += " (= " + (this.rows.size - 1) + " constraints)", a += "\nColumns: " + this.columns.size, a += "\nInfeasible Rows: " + this._infeasibleRows.size, a += "\nExternal basic variables: " + this._externalRows.size, a += "\nExternal parametric variables: ", a += this._externalParametricVars.size, a += "\n"
                        }, toString: function () {
                            var a = "Tableau:\n";
                            return this.rows.each(function (b, c) {
                                a += b, a += " <==> ", a += c, a += "\n"
                            }), a += "\nColumns:\n", a += this.columns, a += "\nInfeasible rows: ", a += this._infeasibleRows, a += "External basic variables: ", a += this._externalRows, a += "External parametric variables: ", a += this._externalParametricVars
                        }, insertColVar: function (b, c) {
                            var d = this.columns.get(b);
                            d || (d = new a.HashSet, this.columns.set(b, d)), d.add(c)
                        }, addRow: function (b, c) {
                            a.trace && a.fnenterprint("addRow: " + b + ", " + c), this.rows.set(b, c), c.terms.each(function (a) {
                                this.insertColVar(a, b), a.isExternal && this._externalParametricVars.add(a)
                            }, this), b.isExternal && this._externalRows.add(b), a.trace && a.traceprint("" + this)
                        }, removeColumn: function (b) {
                            a.trace && a.fnenterprint("removeColumn:" + b);
                            var c = this.columns.get(b);
                            c ? (this.columns.delete(b), c.each(function (a) {
                                var c = this.rows.get(a);
                                c.terms.delete(b)
                            }, this)) : a.trace && console.log("Could not find var", b, "in columns"), b.isExternal && (this._externalRows.delete(b), this._externalParametricVars.delete(b))
                        }, removeRow: function (b) {
                            a.trace && a.fnenterprint("removeRow:" + b);
                            var c = this.rows.get(b);
                            return a.assert(null != c), c.terms.each(function (c) {
                                var e = this.columns.get(c);
                                null != e && (a.trace && console.log("removing from varset:", b), e.delete(b))
                            }, this), this._infeasibleRows.delete(b), b.isExternal && this._externalRows.delete(b), this.rows.delete(b), a.trace && a.fnexitprint("returning " + c), c
                        }, substituteOut: function (b, c) {
                            a.trace && a.fnenterprint("substituteOut:" + b + ", " + c), a.trace && a.traceprint("" + this);
                            var d = this.columns.get(b);
                            d.each(function (a) {
                                var d = this.rows.get(a);
                                d.substituteOut(b, c, a, this), a.isRestricted && 0 > d.constant && this._infeasibleRows.add(a)
                            }, this), b.isExternal && (this._externalRows.add(b), this._externalParametricVars.delete(b)), this.columns.delete(b)
                        }, columnsHasKey: function (a) {
                            return !!this.columns.get(a)
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    var b = a.Tableau, c = b.prototype, d = 1e-8, e = a.Strength.weak;
                    a.SimplexSolver = a.inherit({
                        "extends": a.Tableau, initialize: function () {
                            a.Tableau.call(this), this._stayMinusErrorVars = [], this._stayPlusErrorVars = [], this._errorVars = new a.HashTable, this._markerVars = new a.HashTable, this._objective = new a.ObjectiveVariable({name: "Z"}), this._editVarMap = new a.HashTable, this._editVarList = [], this._slackCounter = 0, this._artificialCounter = 0, this._dummyCounter = 0, this.autoSolve = !0, this._fNeedsSolving = !1, this._optimizeCount = 0, this.rows.set(this._objective, new a.Expression), this._stkCedcns = [0], a.trace && a.traceprint("objective expr == " + this.rows.get(this._objective))
                        }, addLowerBound: function (b, c) {
                            var d = new a.Inequality(b, a.GEQ, new a.Expression(c));
                            return this.addConstraint(d)
                        }, addUpperBound: function (b, c) {
                            var d = new a.Inequality(b, a.LEQ, new a.Expression(c));
                            return this.addConstraint(d)
                        }, addBounds: function (a, b, c) {
                            return this.addLowerBound(a, b), this.addUpperBound(a, c), this
                        }, add: function () {
                            for (var a = 0; arguments.length > a; a++) this.addConstraint(arguments[a]);
                            return this
                        }, addConstraint: function (b) {
                            a.trace && a.fnenterprint("addConstraint: " + b);
                            var c = Array(2), d = Array(1), e = this.newExpression(b, c, d);
                            if (d = d[0], this.tryAddingDirectly(e) || this.addWithArtificialVariable(e), this._fNeedsSolving = !0, b.isEditConstraint) {
                                var f = this._editVarMap.size, g = c[0], h = c[1];
                                !g instanceof a.SlackVariable && console.warn("cvEplus not a slack variable =", g), !h instanceof a.SlackVariable && console.warn("cvEminus not a slack variable =", h), a.debug && console.log("new c.EditInfo(" + b + ", " + g + ", " + h + ", " + d + ", " + f + ")");
                                var i = new a.EditInfo(b, g, h, d, f);
                                this._editVarMap.set(b.variable, i), this._editVarList[f] = {v: b.variable, info: i}
                            }
                            return this.autoSolve && (this.optimize(this._objective), this._setExternalVariables()), this
                        }, addConstraintNoException: function (b) {
                            a.trace && a.fnenterprint("addConstraintNoException: " + b);
                            try {
                                return this.addConstraint(b), !0
                            } catch (c) {
                                return !1
                            }
                        }, addEditVar: function (b, c) {
                            return a.trace && a.fnenterprint("addEditVar: " + b + " @ " + c), this.addConstraint(new a.EditConstraint(b, c || a.Strength.strong))
                        }, beginEdit: function () {
                            return a.assert(this._editVarMap.size > 0, "_editVarMap.size > 0"), this._infeasibleRows.clear(), this._resetStayConstants(), this._stkCedcns.push(this._editVarMap.size), this
                        }, endEdit: function () {
                            return a.assert(this._editVarMap.size > 0, "_editVarMap.size > 0"), this.resolve(), this._stkCedcns.pop(), this.removeEditVarsTo(this._stkCedcns[this._stkCedcns.length - 1]), this
                        }, removeAllEditVars: function () {
                            return this.removeEditVarsTo(0)
                        }, removeEditVarsTo: function (b) {
                            try {
                                for (var c = this._editVarList.length, d = b; c > d; d++) this._editVarList[d] && this.removeConstraint(this._editVarMap.get(this._editVarList[d].v).constraint);
                                return this._editVarList.length = b, a.assert(this._editVarMap.size == b, "_editVarMap.size == n"), this
                            } catch (e) {
                                throw new a.InternalError("Constraint not found in removeEditVarsTo")
                            }
                        }, addPointStays: function (b) {
                            return a.trace && console.log("addPointStays", b), b.forEach(function (a, b) {
                                this.addStay(a.x, e, Math.pow(2, b)), this.addStay(a.y, e, Math.pow(2, b))
                            }, this), this
                        }, addStay: function (b, c, d) {
                            var f = new a.StayConstraint(b, c || e, d || 1);
                            return this.addConstraint(f)
                        }, removeConstraint: function (a) {
                            return this.removeConstraintInternal(a), this
                        }, removeConstraintInternal: function (b) {
                            a.trace && a.fnenterprint("removeConstraintInternal: " + b), a.trace && a.traceprint("" + this), this._fNeedsSolving = !0, this._resetStayConstants();
                            var c = this.rows.get(this._objective), d = this._errorVars.get(b);
                            a.trace && a.traceprint("eVars == " + d), null != d && d.each(function (e) {
                                var f = this.rows.get(e);
                                null == f ? c.addVariable(e, -b.weight * b.strength.symbolicWeight.value, this._objective, this) : c.addExpression(f, -b.weight * b.strength.symbolicWeight.value, this._objective, this), a.trace && a.traceprint("now eVars == " + d)
                            }, this);
                            var e = this._markerVars.get(b);
                            if (this._markerVars.delete(b), null == e) throw new a.InternalError("Constraint not found in removeConstraintInternal");
                            if (a.trace && a.traceprint("Looking to remove var " + e), null == this.rows.get(e)) {
                                var f = this.columns.get(e);
                                a.trace && a.traceprint("Must pivot -- columns are " + f);
                                var g = null, h = 0;
                                f.each(function (b) {
                                    if (b.isRestricted) {
                                        var c = this.rows.get(b), d = c.coefficientFor(e);
                                        if (a.trace && a.traceprint("Marker " + e + "'s coefficient in " + c + " is " + d), 0 > d) {
                                            var f = -c.constant / d;
                                            (null == g || h > f || a.approx(f, h) && b.hashCode < g.hashCode) && (h = f, g = b)
                                        }
                                    }
                                }, this), null == g && (a.trace && a.traceprint("exitVar is still null"), f.each(function (a) {
                                    if (a.isRestricted) {
                                        var b = this.rows.get(a), c = b.coefficientFor(e), d = b.constant / c;
                                        (null == g || h > d) && (h = d, g = a)
                                    }
                                }, this)), null == g && (0 == f.size ? this.removeColumn(e) : f.escapingEach(function (a) {
                                    return a != this._objective ? (g = a, {brk: !0}) : void 0
                                }, this)), null != g && this.pivot(e, g)
                            }
                            if (null != this.rows.get(e) && this.removeRow(e), null != d && d.each(function (a) {
                                a != e && this.removeColumn(a)
                            }, this), b.isStayConstraint) {
                                if (null != d) for (var j = 0; this._stayPlusErrorVars.length > j; j++) d.delete(this._stayPlusErrorVars[j]), d.delete(this._stayMinusErrorVars[j])
                            } else if (b.isEditConstraint) {
                                a.assert(null != d, "eVars != null");
                                var k = this._editVarMap.get(b.variable);
                                this.removeColumn(k.editMinus), this._editVarMap.delete(b.variable)
                            }
                            return null != d && this._errorVars.delete(d), this.autoSolve && (this.optimize(this._objective), this._setExternalVariables()), this
                        }, reset: function () {
                            throw a.trace && a.fnenterprint("reset"), new a.InternalError("reset not implemented")
                        }, resolveArray: function (b) {
                            a.trace && a.fnenterprint("resolveArray" + b);
                            var c = b.length;
                            this._editVarMap.each(function (a, d) {
                                var e = d.index;
                                c > e && this.suggestValue(a, b[e])
                            }, this), this.resolve()
                        }, resolvePair: function (a, b) {
                            this.suggestValue(this._editVarList[0].v, a), this.suggestValue(this._editVarList[1].v, b), this.resolve()
                        }, resolve: function () {
                            a.trace && a.fnenterprint("resolve()"), this.dualOptimize(), this._setExternalVariables(), this._infeasibleRows.clear(), this._resetStayConstants()
                        }, suggestValue: function (b, c) {
                            a.trace && console.log("suggestValue(" + b + ", " + c + ")");
                            var d = this._editVarMap.get(b);
                            if (!d) throw new a.Error("suggestValue for variable " + b + ", but var is not an edit variable");
                            var e = c - d.prevEditConstant;
                            return d.prevEditConstant = c, this.deltaEditConstant(e, d.editPlus, d.editMinus), this
                        }, solve: function () {
                            return this._fNeedsSolving && (this.optimize(this._objective), this._setExternalVariables()), this
                        }, setEditedValue: function (b, c) {
                            if (!this.columnsHasKey(b) && null == this.rows.get(b)) return b.value = c, this;
                            if (!a.approx(c, b.value)) {
                                this.addEditVar(b), this.beginEdit();
                                try {
                                    this.suggestValue(b, c)
                                } catch (d) {
                                    throw new a.InternalError("Error in setEditedValue")
                                }
                                this.endEdit()
                            }
                            return this
                        }, addVar: function (b) {
                            if (!this.columnsHasKey(b) && null == this.rows.get(b)) {
                                try {
                                    this.addStay(b)
                                } catch (c) {
                                    throw new a.InternalError("Error in addVar -- required failure is impossible")
                                }
                                a.trace && a.traceprint("added initial stay on " + b)
                            }
                            return this
                        }, getInternalInfo: function () {
                            var a = c.getInternalInfo.call(this);
                            return a += "\nSolver info:\n", a += "Stay Error Variables: ", a += this._stayPlusErrorVars.length + this._stayMinusErrorVars.length, a += " (" + this._stayPlusErrorVars.length + " +, ", a += this._stayMinusErrorVars.length + " -)\n", a += "Edit Variables: " + this._editVarMap.size, a += "\n"
                        }, getDebugInfo: function () {
                            return "" + this + this.getInternalInfo() + "\n"
                        }, toString: function () {
                            var a = c.getInternalInfo.call(this);
                            return a += "\n_stayPlusErrorVars: ", a += "[" + this._stayPlusErrorVars + "]", a += "\n_stayMinusErrorVars: ", a += "[" + this._stayMinusErrorVars + "]", a += "\n", a += "_editVarMap:\n" + this._editVarMap, a += "\n"
                        }, getConstraintMap: function () {
                            return this._markerVars
                        }, addWithArtificialVariable: function (b) {
                            a.trace && a.fnenterprint("addWithArtificialVariable: " + b);
                            var c = new a.SlackVariable({value: ++this._artificialCounter, prefix: "a"}),
                                d = new a.ObjectiveVariable({name: "az"}), e = b.clone();
                            a.trace && a.traceprint("before addRows:\n" + this), this.addRow(d, e), this.addRow(c, b), a.trace && a.traceprint("after addRows:\n" + this), this.optimize(d);
                            var f = this.rows.get(d);
                            if (a.trace && a.traceprint("azTableauRow.constant == " + f.constant), !a.approx(f.constant, 0)) throw this.removeRow(d), this.removeColumn(c), new a.RequiredFailure;
                            var g = this.rows.get(c);
                            if (null != g) {
                                if (g.isConstant) return this.removeRow(c), this.removeRow(d), void 0;
                                var h = g.anyPivotableVariable();
                                this.pivot(h, c)
                            }
                            a.assert(null == this.rows.get(c), "rowExpression(av) == null"), this.removeColumn(c), this.removeRow(d)
                        }, tryAddingDirectly: function (b) {
                            a.trace && a.fnenterprint("tryAddingDirectly: " + b);
                            var c = this.chooseSubject(b);
                            return null == c ? (a.trace && a.fnexitprint("returning false"), !1) : (b.newSubject(c), this.columnsHasKey(c) && this.substituteOut(c, b), this.addRow(c, b), a.trace && a.fnexitprint("returning true"), !0)
                        }, chooseSubject: function (b) {
                            a.trace && a.fnenterprint("chooseSubject: " + b);
                            var c = null, d = !1, e = !1, f = b.terms, g = f.escapingEach(function (a, b) {
                                if (d) {
                                    if (!a.isRestricted && !this.columnsHasKey(a)) return {retval: a}
                                } else if (a.isRestricted) {
                                    if (!e && !a.isDummy && 0 > b) {
                                        var f = this.columns.get(a);
                                        (null == f || 1 == f.size && this.columnsHasKey(this._objective)) && (c = a, e = !0)
                                    }
                                } else c = a, d = !0
                            }, this);
                            if (g && void 0 !== g.retval) return g.retval;
                            if (null != c) return c;
                            var h = 0, g = f.escapingEach(function (a, b) {
                                return a.isDummy ? (this.columnsHasKey(a) || (c = a, h = b), void 0) : {retval: null}
                            }, this);
                            if (g && void 0 !== g.retval) return g.retval;
                            if (!a.approx(b.constant, 0)) throw new a.RequiredFailure;
                            return h > 0 && b.multiplyMe(-1), c
                        }, deltaEditConstant: function (b, c, d) {
                            a.trace && a.fnenterprint("deltaEditConstant :" + b + ", " + c + ", " + d);
                            var e = this.rows.get(c);
                            if (null != e) return e.constant += b, 0 > e.constant && this._infeasibleRows.add(c), void 0;
                            var f = this.rows.get(d);
                            if (null != f) return f.constant += -b, 0 > f.constant && this._infeasibleRows.add(d), void 0;
                            var g = this.columns.get(d);
                            g || console.log("columnVars is null -- tableau is:\n" + this), g.each(function (a) {
                                var c = this.rows.get(a), e = c.coefficientFor(d);
                                c.constant += e * b, a.isRestricted && 0 > c.constant && this._infeasibleRows.add(a)
                            }, this)
                        }, dualOptimize: function () {
                            a.trace && a.fnenterprint("dualOptimize:");
                            for (var b = this.rows.get(this._objective); this._infeasibleRows.size;) {
                                var c = this._infeasibleRows.values()[0];
                                this._infeasibleRows.delete(c);
                                var d = null, e = this.rows.get(c);
                                if (e && 0 > e.constant) {
                                    var g, f = Number.MAX_VALUE, h = e.terms;
                                    if (h.each(function (c, e) {
                                        if (e > 0 && c.isPivotable) {
                                            var h = b.coefficientFor(c);
                                            g = h / e, (f > g || a.approx(g, f) && c.hashCode < d.hashCode) && (d = c, f = g)
                                        }
                                    }), f == Number.MAX_VALUE) throw new a.InternalError("ratio == nil (MAX_VALUE) in dualOptimize");
                                    this.pivot(d, c)
                                }
                            }
                        }, newExpression: function (b, c, d) {
                            a.trace && (a.fnenterprint("newExpression: " + b), a.traceprint("cn.isInequality == " + b.isInequality), a.traceprint("cn.required == " + b.required));
                            var e = b.expression, f = new a.Expression(e.constant), g = new a.SlackVariable,
                                h = new a.DummyVariable, i = new a.SlackVariable, j = new a.SlackVariable, k = e.terms;
                            if (k.each(function (a, b) {
                                var c = this.rows.get(a);
                                c ? f.addExpression(c, b) : f.addVariable(a, b)
                            }, this), b.isInequality) {
                                if (a.trace && a.traceprint("Inequality, adding slack"), ++this._slackCounter, g = new a.SlackVariable({
                                    value: this._slackCounter,
                                    prefix: "s"
                                }), f.setVariable(g, -1), this._markerVars.set(b, g), !b.required) {
                                    ++this._slackCounter, i = new a.SlackVariable({
                                        value: this._slackCounter,
                                        prefix: "em"
                                    }), f.setVariable(i, 1);
                                    var l = this.rows.get(this._objective);
                                    l.setVariable(i, b.strength.symbolicWeight.value * b.weight), this.insertErrorVar(b, i), this.noteAddedVariable(i, this._objective)
                                }
                            } else if (b.required) a.trace && a.traceprint("Equality, required"), ++this._dummyCounter, h = new a.DummyVariable({
                                value: this._dummyCounter,
                                prefix: "d"
                            }), f.setVariable(h, 1), this._markerVars.set(b, h), a.trace && a.traceprint("Adding dummyVar == d" + this._dummyCounter); else {
                                a.trace && a.traceprint("Equality, not required"), ++this._slackCounter, j = new a.SlackVariable({
                                    value: this._slackCounter,
                                    prefix: "ep"
                                }), i = new a.SlackVariable({
                                    value: this._slackCounter,
                                    prefix: "em"
                                }), f.setVariable(j, -1), f.setVariable(i, 1), this._markerVars.set(b, j);
                                var l = this.rows.get(this._objective);
                                a.trace && console.log(l);
                                var m = b.strength.symbolicWeight.value * b.weight;
                                0 == m && (a.trace && a.traceprint("cn == " + b), a.trace && a.traceprint("adding " + j + " and " + i + " with swCoeff == " + m)), l.setVariable(j, m), this.noteAddedVariable(j, this._objective), l.setVariable(i, m), this.noteAddedVariable(i, this._objective), this.insertErrorVar(b, i), this.insertErrorVar(b, j), b.isStayConstraint ? (this._stayPlusErrorVars.push(j), this._stayMinusErrorVars.push(i)) : b.isEditConstraint && (c[0] = j, c[1] = i, d[0] = e.constant)
                            }
                            return 0 > f.constant && f.multiplyMe(-1), a.trace && a.fnexitprint("returning " + f), f
                        }, optimize: function (b) {
                            a.trace && a.fnenterprint("optimize: " + b), a.trace && a.traceprint("" + this), this._optimizeCount++;
                            var c = this.rows.get(b);
                            a.assert(null != c, "zRow != null");
                            for (var g, h, e = null, f = null; ;) {
                                if (g = 0, h = c.terms, h.escapingEach(function (a, b) {
                                    return a.isPivotable && g > b ? (g = b, e = a, {brk: 1}) : void 0
                                }, this), g >= -d) return;
                                a.trace && console.log("entryVar:", e, "objectiveCoeff:", g);
                                var i = Number.MAX_VALUE, j = this.columns.get(e), k = 0;
                                if (j.each(function (b) {
                                    if (a.trace && a.traceprint("Checking " + b), b.isPivotable) {
                                        var c = this.rows.get(b), d = c.coefficientFor(e);
                                        a.trace && a.traceprint("pivotable, coeff = " + d), 0 > d && (k = -c.constant / d, (i > k || a.approx(k, i) && b.hashCode < f.hashCode) && (i = k, f = b))
                                    }
                                }, this), i == Number.MAX_VALUE) throw new a.InternalError("Objective function is unbounded in optimize");
                                this.pivot(e, f), a.trace && a.traceprint("" + this)
                            }
                        }, pivot: function (b, c) {
                            a.trace && console.log("pivot: ", b, c);
                            var d = !1;
                            d && console.time(" SimplexSolver::pivot"), null == b && console.warn("pivot: entryVar == null"), null == c && console.warn("pivot: exitVar == null"), d && console.time("  removeRow");
                            var e = this.removeRow(c);
                            d && console.timeEnd("  removeRow"), d && console.time("  changeSubject"), e.changeSubject(c, b), d && console.timeEnd("  changeSubject"), d && console.time("  substituteOut"), this.substituteOut(b, e), d && console.timeEnd("  substituteOut"), d && console.time("  addRow"), this.addRow(b, e), d && console.timeEnd("  addRow"), d && console.timeEnd(" SimplexSolver::pivot")
                        }, _resetStayConstants: function () {
                            a.trace && console.log("_resetStayConstants");
                            for (var b = 0; this._stayPlusErrorVars.length > b; b++) {
                                var c = this.rows.get(this._stayPlusErrorVars[b]);
                                null == c && (c = this.rows.get(this._stayMinusErrorVars[b])), null != c && (c.constant = 0)
                            }
                        }, _setExternalVariables: function () {
                            a.trace && a.fnenterprint("_setExternalVariables:"), a.trace && a.traceprint("" + this), this._externalParametricVars.each(function (b) {
                                null != this.rows.get(b) ? a.trace && console.log("Error: variable" + b + " in _externalParametricVars is basic") : b.value = 0
                            }, this), this._externalRows.each(function (a) {
                                var b = this.rows.get(a);
                                a.value != b.constant && (a.value = b.constant)
                            }, this), this._fNeedsSolving = !1, this.onsolved()
                        }, onsolved: function () {
                        }, insertErrorVar: function (b, c) {
                            a.trace && a.fnenterprint("insertErrorVar:" + b + ", " + c);
                            var d = this._errorVars.get(c);
                            d || (d = new a.HashSet, this._errorVars.set(b, d)), d.add(c)
                        }
                    })
                }(this.c || module.parent.exports || {}), function (a) {
                    "use strict";
                    a.Timer = a.inherit({
                        initialize: function () {
                            this.isRunning = !1, this._elapsedMs = 0
                        }, start: function () {
                            return this.isRunning = !0, this._startReading = new Date, this
                        }, stop: function () {
                            return this.isRunning = !1, this._elapsedMs += new Date - this._startReading, this
                        }, reset: function () {
                            return this.isRunning = !1, this._elapsedMs = 0, this
                        }, elapsedTime: function () {
                            return this.isRunning ? (this._elapsedMs + (new Date - this._startReading)) / 1e3 : this._elapsedMs / 1e3
                        }
                    })
                }(this.c || module.parent.exports || {}), __cassowary_parser = function () {
                    function a(a) {
                        return '"' + a.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\x08/g, "\\b").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\f/g, "\\f").replace(/\r/g, "\\r").replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape) + '"'
                    }

                    var b = {
                        parse: function (b, c) {
                            function k(a) {
                                g > e || (e > g && (g = e, h = []), h.push(a))
                            }

                            function l() {
                                var a, b, c, d, f;
                                if (d = e, f = e, a = z(), null !== a) {
                                    if (c = m(), null !== c) for (b = []; null !== c;) b.push(c), c = m(); else b = null;
                                    null !== b ? (c = z(), null !== c ? a = [a, b, c] : (a = null, e = f)) : (a = null, e = f)
                                } else a = null, e = f;
                                return null !== a && (a = function (a, b) {
                                    return b
                                }(d, a[1])), null === a && (e = d), a
                            }

                            function m() {
                                var a, b, c, d;
                                return c = e, d = e, a = P(), null !== a ? (b = s(), null !== b ? a = [a, b] : (a = null, e = d)) : (a = null, e = d), null !== a && (a = function (a, b) {
                                    return b
                                }(c, a[0])), null === a && (e = c), a
                            }

                            function n() {
                                var a;
                                return b.length > e ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("any character")), a
                            }

                            function o() {
                                var a;
                                return /^[a-zA-Z]/.test(b.charAt(e)) ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("[a-zA-Z]")), null === a && (36 === b.charCodeAt(e) ? (a = "$", e++) : (a = null, 0 === f && k('"$"')), null === a && (95 === b.charCodeAt(e) ? (a = "_", e++) : (a = null, 0 === f && k('"_"')))), a
                            }

                            function p() {
                                var a;
                                return f++, /^[\t\x0B\f \xA0\uFEFF]/.test(b.charAt(e)) ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("[\\t\\x0B\\f \\xA0\\uFEFF]")), f--, 0 === f && null === a && k("whitespace"), a
                            }

                            function q() {
                                var a;
                                return /^[\n\r\u2028\u2029]/.test(b.charAt(e)) ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("[\\n\\r\\u2028\\u2029]")), a
                            }

                            function r() {
                                var a;
                                return f++, 10 === b.charCodeAt(e) ? (a = "\n", e++) : (a = null, 0 === f && k('"\\n"')), null === a && ("\r\n" === b.substr(e, 2) ? (a = "\r\n", e += 2) : (a = null, 0 === f && k('"\\r\\n"')), null === a && (13 === b.charCodeAt(e) ? (a = "\r", e++) : (a = null, 0 === f && k('"\\r"')), null === a && (8232 === b.charCodeAt(e) ? (a = "\u2028", e++) : (a = null, 0 === f && k('"\\u2028"')), null === a && (8233 === b.charCodeAt(e) ? (a = "\u2029", e++) : (a = null, 0 === f && k('"\\u2029"')))))), f--, 0 === f && null === a && k("end of line"), a
                            }

                            function s() {
                                var a, c, d;
                                return d = e, a = z(), null !== a ? (59 === b.charCodeAt(e) ? (c = ";", e++) : (c = null, 0 === f && k('";"')), null !== c ? a = [a, c] : (a = null, e = d)) : (a = null, e = d), null === a && (d = e, a = y(), null !== a ? (c = r(), null !== c ? a = [a, c] : (a = null, e = d)) : (a = null, e = d), null === a && (d = e, a = z(), null !== a ? (c = t(), null !== c ? a = [a, c] : (a = null, e = d)) : (a = null, e = d))), a
                            }

                            function t() {
                                var a, c;
                                return c = e, f++, b.length > e ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("any character")), f--, null === a ? a = "" : (a = null, e = c), a
                            }

                            function u() {
                                var a;
                                return f++, a = v(), null === a && (a = x()), f--, 0 === f && null === a && k("comment"), a
                            }

                            function v() {
                                var a, c, d, g, h, i, j;
                                if (h = e, "/*" === b.substr(e, 2) ? (a = "/*", e += 2) : (a = null, 0 === f && k('"/*"')), null !== a) {
                                    for (c = [], i = e, j = e, f++, "*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i); null !== d;) c.push(d), i = e, j = e, f++, "*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i);
                                    null !== c ? ("*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), null !== d ? a = [a, c, d] : (a = null, e = h)) : (a = null, e = h)
                                } else a = null, e = h;
                                return a
                            }

                            function w() {
                                var a, c, d, g, h, i, j;
                                if (h = e, "/*" === b.substr(e, 2) ? (a = "/*", e += 2) : (a = null, 0 === f && k('"/*"')), null !== a) {
                                    for (c = [], i = e, j = e, f++, "*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), null === d && (d = q()), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i); null !== d;) c.push(d), i = e, j = e, f++, "*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), null === d && (d = q()), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i);
                                    null !== c ? ("*/" === b.substr(e, 2) ? (d = "*/", e += 2) : (d = null, 0 === f && k('"*/"')), null !== d ? a = [a, c, d] : (a = null, e = h)) : (a = null, e = h)
                                } else a = null, e = h;
                                return a
                            }

                            function x() {
                                var a, c, d, g, h, i, j;
                                if (h = e, "//" === b.substr(e, 2) ? (a = "//", e += 2) : (a = null, 0 === f && k('"//"')), null !== a) {
                                    for (c = [], i = e, j = e, f++, d = q(), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i); null !== d;) c.push(d), i = e, j = e, f++, d = q(), f--, null === d ? d = "" : (d = null, e = j), null !== d ? (g = n(), null !== g ? d = [d, g] : (d = null, e = i)) : (d = null, e = i);
                                    null !== c ? a = [a, c] : (a = null, e = h)
                                } else a = null, e = h;
                                return a
                            }

                            function y() {
                                var a, b;
                                for (a = [], b = p(), null === b && (b = w(), null === b && (b = x())); null !== b;) a.push(b), b = p(), null === b && (b = w(), null === b && (b = x()));
                                return a
                            }

                            function z() {
                                var a, b;
                                for (a = [], b = p(), null === b && (b = r(), null === b && (b = u())); null !== b;) a.push(b), b = p(), null === b && (b = r(), null === b && (b = u()));
                                return a
                            }

                            function A() {
                                var a, b;
                                return b = e, a = C(), null === a && (a = B()), null !== a && (a = function (a, b) {
                                    return {type: "NumericLiteral", value: b}
                                }(b, a)), null === a && (e = b), a
                            }

                            function B() {
                                var a, c, d;
                                if (d = e, /^[0-9]/.test(b.charAt(e)) ? (c = b.charAt(e), e++) : (c = null, 0 === f && k("[0-9]")), null !== c) for (a = []; null !== c;) a.push(c), /^[0-9]/.test(b.charAt(e)) ? (c = b.charAt(e), e++) : (c = null, 0 === f && k("[0-9]")); else a = null;
                                return null !== a && (a = function (a, b) {
                                    return parseInt(b.join(""))
                                }(d, a)), null === a && (e = d), a
                            }

                            function C() {
                                var a, c, d, g, h;
                                return g = e, h = e, a = B(), null !== a ? (46 === b.charCodeAt(e) ? (c = ".", e++) : (c = null, 0 === f && k('"."')), null !== c ? (d = B(), null !== d ? a = [a, c, d] : (a = null, e = h)) : (a = null, e = h)) : (a = null, e = h), null !== a && (a = function (a, b) {
                                    return parseFloat(b.join(""))
                                }(g, a)), null === a && (e = g), a
                            }

                            function D() {
                                var a, c, d, g;
                                if (g = e, /^[\-+]/.test(b.charAt(e)) ? (a = b.charAt(e), e++) : (a = null, 0 === f && k("[\\-+]")), a = null !== a ? a : "", null !== a) {
                                    if (/^[0-9]/.test(b.charAt(e)) ? (d = b.charAt(e), e++) : (d = null, 0 === f && k("[0-9]")), null !== d) for (c = []; null !== d;) c.push(d), /^[0-9]/.test(b.charAt(e)) ? (d = b.charAt(e), e++) : (d = null, 0 === f && k("[0-9]")); else c = null;
                                    null !== c ? a = [a, c] : (a = null, e = g)
                                } else a = null, e = g;
                                return a
                            }

                            function E() {
                                var a, b;
                                return f++, b = e, a = F(), null !== a && (a = function (a, b) {
                                    return b
                                }(b, a)), null === a && (e = b), f--, 0 === f && null === a && k("identifier"), a
                            }

                            function F() {
                                var a, b, c, d, g;
                                if (f++, d = e, g = e, a = o(), null !== a) {
                                    for (b = [], c = o(); null !== c;) b.push(c), c = o();
                                    null !== b ? a = [a, b] : (a = null, e = g)
                                } else a = null, e = g;
                                return null !== a && (a = function (a, b, c) {
                                    return b + c.join("")
                                }(d, a[0], a[1])), null === a && (e = d), f--, 0 === f && null === a && k("identifier"), a
                            }

                            function G() {
                                var a, c, d, g, h, i, j;
                                return i = e, a = E(), null !== a && (a = function (a, b) {
                                    return {type: "Variable", name: b}
                                }(i, a)), null === a && (e = i), null === a && (a = A(), null === a && (i = e, j = e, 40 === b.charCodeAt(e) ? (a = "(", e++) : (a = null, 0 === f && k('"("')), null !== a ? (c = z(), null !== c ? (d = P(), null !== d ? (g = z(), null !== g ? (41 === b.charCodeAt(e) ? (h = ")", e++) : (h = null, 0 === f && k('")"')), null !== h ? a = [a, c, d, g, h] : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j), null !== a && (a = function (a, b) {
                                    return b
                                }(i, a[2])), null === a && (e = i))), a
                            }

                            function H() {
                                var a, b, c, d, f;
                                return a = G(), null === a && (d = e, f = e, a = I(), null !== a ? (b = z(), null !== b ? (c = H(), null !== c ? a = [a, b, c] : (a = null, e = f)) : (a = null, e = f)) : (a = null, e = f), null !== a && (a = function (a, b, c) {
                                    return {type: "UnaryExpression", operator: b, expression: c}
                                }(d, a[0], a[2])), null === a && (e = d)), a
                            }

                            function I() {
                                var a;
                                return 43 === b.charCodeAt(e) ? (a = "+", e++) : (a = null, 0 === f && k('"+"')), null === a && (45 === b.charCodeAt(e) ? (a = "-", e++) : (a = null, 0 === f && k('"-"')), null === a && (33 === b.charCodeAt(e) ? (a = "!", e++) : (a = null, 0 === f && k('"!"')))), a
                            }

                            function J() {
                                var a, b, c, d, f, g, h, i, j;
                                if (h = e, i = e, a = H(), null !== a) {
                                    for (b = [], j = e, c = z(), null !== c ? (d = K(), null !== d ? (f = z(), null !== f ? (g = H(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j); null !== c;) b.push(c), j = e, c = z(), null !== c ? (d = K(), null !== d ? (f = z(), null !== f ? (g = H(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j);
                                    null !== b ? a = [a, b] : (a = null, e = i)
                                } else a = null, e = i;
                                return null !== a && (a = function (a, b, c) {
                                    for (var d = b, e = 0; c.length > e; e++) d = {
                                        type: "MultiplicativeExpression",
                                        operator: c[e][1],
                                        left: d,
                                        right: c[e][3]
                                    };
                                    return d
                                }(h, a[0], a[1])), null === a && (e = h), a
                            }

                            function K() {
                                var a;
                                return 42 === b.charCodeAt(e) ? (a = "*", e++) : (a = null, 0 === f && k('"*"')), null === a && (47 === b.charCodeAt(e) ? (a = "/", e++) : (a = null, 0 === f && k('"/"'))), a
                            }

                            function L() {
                                var a, b, c, d, f, g, h, i, j;
                                if (h = e, i = e, a = J(), null !== a) {
                                    for (b = [], j = e, c = z(), null !== c ? (d = M(), null !== d ? (f = z(), null !== f ? (g = J(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j); null !== c;) b.push(c), j = e, c = z(), null !== c ? (d = M(), null !== d ? (f = z(), null !== f ? (g = J(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j);
                                    null !== b ? a = [a, b] : (a = null, e = i)
                                } else a = null, e = i;
                                return null !== a && (a = function (a, b, c) {
                                    for (var d = b, e = 0; c.length > e; e++) d = {
                                        type: "AdditiveExpression",
                                        operator: c[e][1],
                                        left: d,
                                        right: c[e][3]
                                    };
                                    return d
                                }(h, a[0], a[1])), null === a && (e = h), a
                            }

                            function M() {
                                var a;
                                return 43 === b.charCodeAt(e) ? (a = "+", e++) : (a = null, 0 === f && k('"+"')), null === a && (45 === b.charCodeAt(e) ? (a = "-", e++) : (a = null, 0 === f && k('"-"'))), a
                            }

                            function N() {
                                var a, b, c, d, f, g, h, i, j;
                                if (h = e, i = e, a = L(), null !== a) {
                                    for (b = [], j = e, c = z(), null !== c ? (d = O(), null !== d ? (f = z(), null !== f ? (g = L(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j); null !== c;) b.push(c), j = e, c = z(), null !== c ? (d = O(), null !== d ? (f = z(), null !== f ? (g = L(), null !== g ? c = [c, d, f, g] : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j)) : (c = null, e = j);
                                    null !== b ? a = [a, b] : (a = null, e = i)
                                } else a = null, e = i;
                                return null !== a && (a = function (a, b, c) {
                                    for (var d = b, e = 0; c.length > e; e++) d = {
                                        type: "Inequality",
                                        operator: c[e][1],
                                        left: d,
                                        right: c[e][3]
                                    };
                                    return d
                                }(h, a[0], a[1])), null === a && (e = h), a
                            }

                            function O() {
                                var a;
                                return "<=" === b.substr(e, 2) ? (a = "<=", e += 2) : (a = null, 0 === f && k('"<="')), null === a && (">=" === b.substr(e, 2) ? (a = ">=", e += 2) : (a = null, 0 === f && k('">="')), null === a && (60 === b.charCodeAt(e) ? (a = "<", e++) : (a = null, 0 === f && k('"<"')), null === a && (62 === b.charCodeAt(e) ? (a = ">", e++) : (a = null, 0 === f && k('">"'))))), a
                            }

                            function P() {
                                var a, c, d, g, h, i, j, l, m;
                                if (j = e, l = e, a = N(), null !== a) {
                                    for (c = [], m = e, d = z(), null !== d ? ("==" === b.substr(e, 2) ? (g = "==", e += 2) : (g = null, 0 === f && k('"=="')), null !== g ? (h = z(), null !== h ? (i = N(), null !== i ? d = [d, g, h, i] : (d = null, e = m)) : (d = null, e = m)) : (d = null, e = m)) : (d = null, e = m); null !== d;) c.push(d), m = e, d = z(), null !== d ? ("==" === b.substr(e, 2) ? (g = "==", e += 2) : (g = null, 0 === f && k('"=="')), null !== g ? (h = z(), null !== h ? (i = N(), null !== i ? d = [d, g, h, i] : (d = null, e = m)) : (d = null, e = m)) : (d = null, e = m)) : (d = null, e = m);
                                    null !== c ? a = [a, c] : (a = null, e = l)
                                } else a = null, e = l;
                                return null !== a && (a = function (a, b, c) {
                                    for (var d = b, e = 0; c.length > e; e++) d = {
                                        type: "Equality",
                                        operator: c[e][1],
                                        left: d,
                                        right: c[e][3]
                                    };
                                    return d
                                }(j, a[0], a[1])), null === a && (e = j), a
                            }

                            function Q(a) {
                                a.sort();
                                for (var b = null, c = [], d = 0; a.length > d; d++) a[d] !== b && (c.push(a[d]), b = a[d]);
                                return c
                            }

                            function R() {
                                for (var a = 1, c = 1, d = !1, f = 0; Math.max(e, g) > f; f++) {
                                    var h = b.charAt(f);
                                    "\n" === h ? (d || a++, c = 1, d = !1) : "\r" === h || "\u2028" === h || "\u2029" === h ? (a++, c = 1, d = !0) : (c++, d = !1)
                                }
                                return {line: a, column: c}
                            }

                            var d = {
                                start: l,
                                Statement: m,
                                SourceCharacter: n,
                                IdentifierStart: o,
                                WhiteSpace: p,
                                LineTerminator: q,
                                LineTerminatorSequence: r,
                                EOS: s,
                                EOF: t,
                                Comment: u,
                                MultiLineComment: v,
                                MultiLineCommentNoLineTerminator: w,
                                SingleLineComment: x,
                                _: y,
                                __: z,
                                Literal: A,
                                Integer: B,
                                Real: C,
                                SignedInteger: D,
                                Identifier: E,
                                IdentifierName: F,
                                PrimaryExpression: G,
                                UnaryExpression: H,
                                UnaryOperator: I,
                                MultiplicativeExpression: J,
                                MultiplicativeOperator: K,
                                AdditiveExpression: L,
                                AdditiveOperator: M,
                                InequalityExpression: N,
                                InequalityOperator: O,
                                LinearExpression: P
                            };
                            if (void 0 !== c) {
                                if (void 0 === d[c]) throw Error("Invalid rule name: " + a(c) + ".")
                            } else c = "start";
                            var e = 0, f = 0, g = 0, h = [], S = d[c]();
                            if (null === S || e !== b.length) {
                                var T = Math.max(e, g), U = b.length > T ? b.charAt(T) : null, V = R();
                                throw new this.SyntaxError(Q(h), U, T, V.line, V.column)
                            }
                            return S
                        }, toSource: function () {
                            return this._source
                        }
                    };
                    return b.SyntaxError = function (b, c, d, e, f) {
                        function g(b, c) {
                            var d, e;
                            switch (b.length) {
                                case 0:
                                    d = "end of input";
                                    break;
                                case 1:
                                    d = b[0];
                                    break;
                                default:
                                    d = b.slice(0, b.length - 1).join(", ") + " or " + b[b.length - 1]
                            }
                            return e = c ? a(c) : "end of input", "Expected " + d + " but " + e + " found."
                        }

                        this.name = "SyntaxError", this.expected = b, this.found = c, this.message = g(b, c), this.offset = d, this.line = e, this.column = f
                    }, b.SyntaxError.prototype = Error.prototype, b
                }();
            }).call(
                (typeof module != "undefined") ?
                    (module.compiled = true && module) : this
            );

        }, {}]
    }, {}, [1])(1)
});

/////////////////////////////////Autolayout Ends////////////////////////////////////////////////////
//////////////////////////Promise-polyfill/////////////////////////////
!function (e, t) {
    "object" == typeof exports && "undefined" != typeof module ? t() : "function" == typeof define && define.amd ? define(t) : t()
}(0, function () {
    "use strict";

    function e(e) {
        var t = this.constructor;
        return this.then(function (n) {
            return t.resolve(e()).then(function () {
                return n
            })
        }, function (n) {
            return t.resolve(e()).then(function () {
                return t.reject(n)
            })
        })
    }

    function t(e) {
        return new this(function (t, n) {
            function o(e, n) {
                if (n && ("object" == typeof n || "function" == typeof n)) {
                    var f = n.then;
                    if ("function" == typeof f) return void f.call(n, function (t) {
                        o(e, t)
                    }, function (n) {
                        r[e] = {status: "rejected", reason: n}, 0 == --i && t(r)
                    })
                }
                r[e] = {status: "fulfilled", value: n}, 0 == --i && t(r)
            }

            if (!e || "undefined" == typeof e.length) return n(new TypeError(typeof e + " " + e + " is not iterable(cannot read property Symbol(Symbol.iterator))"));
            var r = Array.prototype.slice.call(e);
            if (0 === r.length) return t([]);
            for (var i = r.length, f = 0; r.length > f; f++) o(f, r[f])
        })
    }

    function n(e) {
        return !(!e || "undefined" == typeof e.length)
    }

    function o() {
    }

    function r(e) {
        if (!(this instanceof r)) throw new TypeError("Promises must be constructed via new");
        if ("function" != typeof e) throw new TypeError("not a function");
        this._state = 0, this._handled = !1, this._value = undefined, this._deferreds = [], l(e, this)
    }

    function i(e, t) {
        for (; 3 === e._state;) e = e._value;
        0 !== e._state ? (e._handled = !0, r._immediateFn(function () {
            var n = 1 === e._state ? t.onFulfilled : t.onRejected;
            if (null !== n) {
                var o;
                try {
                    o = n(e._value)
                } catch (r) {
                    return void u(t.promise, r)
                }
                f(t.promise, o)
            } else (1 === e._state ? f : u)(t.promise, e._value)
        })) : e._deferreds.push(t)
    }

    function f(e, t) {
        try {
            if (t === e) throw new TypeError("A promise cannot be resolved with itself.");
            if (t && ("object" == typeof t || "function" == typeof t)) {
                var n = t.then;
                if (t instanceof r) return e._state = 3, e._value = t, void c(e);
                if ("function" == typeof n) return void l(function (e, t) {
                    return function () {
                        e.apply(t, arguments)
                    }
                }(n, t), e)
            }
            e._state = 1, e._value = t, c(e)
        } catch (o) {
            u(e, o)
        }
    }

    function u(e, t) {
        e._state = 2, e._value = t, c(e)
    }

    function c(e) {
        2 === e._state && 0 === e._deferreds.length && r._immediateFn(function () {
            e._handled || r._unhandledRejectionFn(e._value)
        });
        for (var t = 0, n = e._deferreds.length; n > t; t++) i(e, e._deferreds[t]);
        e._deferreds = null
    }

    function l(e, t) {
        var n = !1;
        try {
            e(function (e) {
                n || (n = !0, f(t, e))
            }, function (e) {
                n || (n = !0, u(t, e))
            })
        } catch (o) {
            if (n) return;
            n = !0, u(t, o)
        }
    }

    var a = setTimeout;
    r.prototype["catch"] = function (e) {
        return this.then(null, e)
    }, r.prototype.then = function (e, t) {
        var n = new this.constructor(o);
        return i(this, new function (e, t, n) {
            this.onFulfilled = "function" == typeof e ? e : null, this.onRejected = "function" == typeof t ? t : null, this.promise = n
        }(e, t, n)), n
    }, r.prototype["finally"] = e, r.all = function (e) {
        return new r(function (t, o) {
            function r(e, n) {
                try {
                    if (n && ("object" == typeof n || "function" == typeof n)) {
                        var u = n.then;
                        if ("function" == typeof u) return void u.call(n, function (t) {
                            r(e, t)
                        }, o)
                    }
                    i[e] = n, 0 == --f && t(i)
                } catch (c) {
                    o(c)
                }
            }

            if (!n(e)) return o(new TypeError("Promise.all accepts an array"));
            var i = Array.prototype.slice.call(e);
            if (0 === i.length) return t([]);
            for (var f = i.length, u = 0; i.length > u; u++) r(u, i[u])
        })
    }, r.allSettled = t, r.resolve = function (e) {
        return e && "object" == typeof e && e.constructor === r ? e : new r(function (t) {
            t(e)
        })
    }, r.reject = function (e) {
        return new r(function (t, n) {
            n(e)
        })
    }, r.race = function (e) {
        return new r(function (t, o) {
            if (!n(e)) return o(new TypeError("Promise.race accepts an array"));
            for (var i = 0, f = e.length; f > i; i++) r.resolve(e[i]).then(t, o)
        })
    }, r._immediateFn = "function" == typeof setImmediate && function (e) {
        setImmediate(e)
    } || function (e) {
        a(e, 0)
    }, r._unhandledRejectionFn = function (e) {
        void 0 !== console && console && console.warn("Possible Unhandled Promise Rejection:", e)
    };
    var s = function () {
        if ("undefined" != typeof self) return self;
        if ("undefined" != typeof window) return window;
        if ("undefined" != typeof global) return global;
        throw Error("unable to locate global object")
    }();
    "function" != typeof s.Promise ? s.Promise = r : (s.Promise.prototype["finally"] || (s.Promise.prototype["finally"] = e), s.Promise.allSettled || (s.Promise.allSettled = t))
});

//////////////////////////Promise-polyfill-ends/////////////////////////////



//////////////////////////fetch-polyfill////////////////////////////////////
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
        typeof define === 'function' && define.amd ? define(['exports'], factory) :
            (factory((global.WHATWGFetch = {})));
}(this, (function (exports) { 'use strict';

    var global = (typeof self !== 'undefined' && self) || (typeof global !== 'undefined' && global);

    var support = {
        searchParams: 'URLSearchParams' in global,
        iterable: 'Symbol' in global && 'iterator' in Symbol,
        blob:
            'FileReader' in global &&
            'Blob' in global &&
            (function() {
                try {
                    new Blob();
                    return true
                } catch (e) {
                    return false
                }
            })(),
        formData: 'FormData' in global,
        arrayBuffer: 'ArrayBuffer' in global
    };

    function isDataView(obj) {
        return obj && DataView.prototype.isPrototypeOf(obj)
    }

    if (support.arrayBuffer) {
        var viewClasses = [
            '[object Int8Array]',
            '[object Uint8Array]',
            '[object Uint8ClampedArray]',
            '[object Int16Array]',
            '[object Uint16Array]',
            '[object Int32Array]',
            '[object Uint32Array]',
            '[object Float32Array]',
            '[object Float64Array]'
        ];

        var isArrayBufferView =
            ArrayBuffer.isView ||
            function(obj) {
                return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
            };
    }

    function normalizeName(name) {
        if (typeof name !== 'string') {
            name = String(name);
        }
        if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
            throw new TypeError('Invalid character in header field name')
        }
        return name.toLowerCase()
    }

    function normalizeValue(value) {
        if (typeof value !== 'string') {
            value = String(value);
        }
        return value
    }

    // Build a destructive iterator for the value list
    function iteratorFor(items) {
        var iterator = {
            next: function() {
                var value = items.shift();
                return {done: value === undefined, value: value}
            }
        };

        if (support.iterable) {
            iterator[Symbol.iterator] = function() {
                return iterator
            };
        }

        return iterator
    }

    function Headers(headers) {
        this.map = {};

        if (headers instanceof Headers) {
            headers.forEach(function(value, name) {
                this.append(name, value);
            }, this);
        } else if (Array.isArray(headers)) {
            headers.forEach(function(header) {
                this.append(header[0], header[1]);
            }, this);
        } else if (headers) {
            Object.getOwnPropertyNames(headers).forEach(function(name) {
                this.append(name, headers[name]);
            }, this);
        }
    }

    Headers.prototype.append = function(name, value) {
        name = normalizeName(name);
        value = normalizeValue(value);
        var oldValue = this.map[name];
        this.map[name] = oldValue ? oldValue + ', ' + value : value;
    };

    Headers.prototype['delete'] = function(name) {
        delete this.map[normalizeName(name)];
    };

    Headers.prototype.get = function(name) {
        name = normalizeName(name);
        return this.has(name) ? this.map[name] : null
    };

    Headers.prototype.has = function(name) {
        return this.map.hasOwnProperty(normalizeName(name))
    };

    Headers.prototype.set = function(name, value) {
        this.map[normalizeName(name)] = normalizeValue(value);
    };

    Headers.prototype.forEach = function(callback, thisArg) {
        for (var name in this.map) {
            if (this.map.hasOwnProperty(name)) {
                callback.call(thisArg, this.map[name], name, this);
            }
        }
    };

    Headers.prototype.keys = function() {
        var items = [];
        this.forEach(function(value, name) {
            items.push(name);
        });
        return iteratorFor(items)
    };

    Headers.prototype.values = function() {
        var items = [];
        this.forEach(function(value) {
            items.push(value);
        });
        return iteratorFor(items)
    };

    Headers.prototype.entries = function() {
        var items = [];
        this.forEach(function(value, name) {
            items.push([name, value]);
        });
        return iteratorFor(items)
    };

    if (support.iterable) {
        Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
    }

    function consumed(body) {
        if (body.bodyUsed) {
            return Promise.reject(new TypeError('Already read'))
        }
        body.bodyUsed = true;
    }

    function fileReaderReady(reader) {
        return new Promise(function(resolve, reject) {
            reader.onload = function() {
                resolve(reader.result);
            };
            reader.onerror = function() {
                reject(reader.error);
            };
        })
    }

    function readBlobAsArrayBuffer(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsArrayBuffer(blob);
        return promise
    }

    function readBlobAsText(blob) {
        var reader = new FileReader();
        var promise = fileReaderReady(reader);
        reader.readAsText(blob);
        return promise
    }

    function readArrayBufferAsText(buf) {
        var view = new Uint8Array(buf);
        var chars = new Array(view.length);

        for (var i = 0; i < view.length; i++) {
            chars[i] = String.fromCharCode(view[i]);
        }
        return chars.join('')
    }

    function bufferClone(buf) {
        if (buf.slice) {
            return buf.slice(0)
        } else {
            var view = new Uint8Array(buf.byteLength);
            view.set(new Uint8Array(buf));
            return view.buffer
        }
    }

    function Body() {
        this.bodyUsed = false;

        this._initBody = function(body) {
            /*
              fetch-mock wraps the Response object in an ES6 Proxy to
              provide useful test harness features such as flush. However, on
              ES5 browsers without fetch or Proxy support pollyfills must be used;
              the proxy-pollyfill is unable to proxy an attribute unless it exists
              on the object before the Proxy is created. This change ensures
              Response.bodyUsed exists on the instance, while maintaining the
              semantic of setting Request.bodyUsed in the constructor before
              _initBody is called.
            */
            this.bodyUsed = this.bodyUsed;
            this._bodyInit = body;
            if (!body) {
                this._bodyText = '';
            } else if (typeof body === 'string') {
                this._bodyText = body;
            } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
                this._bodyBlob = body;
            } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
                this._bodyFormData = body;
            } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                this._bodyText = body.toString();
            } else if (support.arrayBuffer && support.blob && isDataView(body)) {
                this._bodyArrayBuffer = bufferClone(body.buffer);
                // IE 10-11 can't handle a DataView body.
                this._bodyInit = new Blob([this._bodyArrayBuffer]);
            } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
                this._bodyArrayBuffer = bufferClone(body);
            } else {
                this._bodyText = body = Object.prototype.toString.call(body);
            }

            if (!this.headers.get('content-type')) {
                if (typeof body === 'string') {
                    this.headers.set('content-type', 'text/plain;charset=UTF-8');
                } else if (this._bodyBlob && this._bodyBlob.type) {
                    this.headers.set('content-type', this._bodyBlob.type);
                } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
                    this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
                }
            }
        };

        if (support.blob) {
            this.blob = function() {
                var rejected = consumed(this);
                if (rejected) {
                    return rejected
                }

                if (this._bodyBlob) {
                    return Promise.resolve(this._bodyBlob)
                } else if (this._bodyArrayBuffer) {
                    return Promise.resolve(new Blob([this._bodyArrayBuffer]))
                } else if (this._bodyFormData) {
                    throw new Error('could not read FormData body as blob')
                } else {
                    return Promise.resolve(new Blob([this._bodyText]))
                }
            };

            this.arrayBuffer = function() {
                if (this._bodyArrayBuffer) {
                    var isConsumed = consumed(this);
                    if (isConsumed) {
                        return isConsumed
                    }
                    if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
                        return Promise.resolve(
                            this._bodyArrayBuffer.buffer.slice(
                                this._bodyArrayBuffer.byteOffset,
                                this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
                            )
                        )
                    } else {
                        return Promise.resolve(this._bodyArrayBuffer)
                    }
                } else {
                    return this.blob().then(readBlobAsArrayBuffer)
                }
            };
        }

        this.text = function() {
            var rejected = consumed(this);
            if (rejected) {
                return rejected
            }

            if (this._bodyBlob) {
                return readBlobAsText(this._bodyBlob)
            } else if (this._bodyArrayBuffer) {
                return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
            } else if (this._bodyFormData) {
                throw new Error('could not read FormData body as text')
            } else {
                return Promise.resolve(this._bodyText)
            }
        };

        if (support.formData) {
            this.formData = function() {
                return this.text().then(decode)
            };
        }

        this.json = function() {
            return this.text().then(JSON.parse)
        };

        return this
    }

    // HTTP methods whose capitalization should be normalized
    var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

    function normalizeMethod(method) {
        var upcased = method.toUpperCase();
        return methods.indexOf(upcased) > -1 ? upcased : method
    }

    function Request(input, options) {
        if (!(this instanceof Request)) {
            throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
        }

        options = options || {};
        var body = options.body;

        if (input instanceof Request) {
            if (input.bodyUsed) {
                throw new TypeError('Already read')
            }
            this.url = input.url;
            this.credentials = input.credentials;
            if (!options.headers) {
                this.headers = new Headers(input.headers);
            }
            this.method = input.method;
            this.mode = input.mode;
            this.signal = input.signal;
            if (!body && input._bodyInit != null) {
                body = input._bodyInit;
                input.bodyUsed = true;
            }
        } else {
            this.url = String(input);
        }

        this.credentials = options.credentials || this.credentials || 'same-origin';
        if (options.headers || !this.headers) {
            this.headers = new Headers(options.headers);
        }
        this.method = normalizeMethod(options.method || this.method || 'GET');
        this.mode = options.mode || this.mode || null;
        this.signal = options.signal || this.signal;
        this.referrer = null;

        if ((this.method === 'GET' || this.method === 'HEAD') && body) {
            throw new TypeError('Body not allowed for GET or HEAD requests')
        }
        this._initBody(body);

        if (this.method === 'GET' || this.method === 'HEAD') {
            if (options.cache === 'no-store' || options.cache === 'no-cache') {
                // Search for a '_' parameter in the query string
                var reParamSearch = /([?&])_=[^&]*/;
                if (reParamSearch.test(this.url)) {
                    // If it already exists then set the value with the current time
                    this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
                } else {
                    // Otherwise add a new '_' parameter to the end with the current time
                    var reQueryString = /\?/;
                    this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
                }
            }
        }
    }

    Request.prototype.clone = function() {
        return new Request(this, {body: this._bodyInit})
    };

    function decode(body) {
        var form = new FormData();
        body
            .trim()
            .split('&')
            .forEach(function(bytes) {
                if (bytes) {
                    var split = bytes.split('=');
                    var name = split.shift().replace(/\+/g, ' ');
                    var value = split.join('=').replace(/\+/g, ' ');
                    form.append(decodeURIComponent(name), decodeURIComponent(value));
                }
            });
        return form
    }

    function parseHeaders(rawHeaders) {
        var headers = new Headers();
        // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
        // https://tools.ietf.org/html/rfc7230#section-3.2
        var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
        preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
            var parts = line.split(':');
            var key = parts.shift().trim();
            if (key) {
                var value = parts.join(':').trim();
                headers.append(key, value);
            }
        });
        return headers
    }

    Body.call(Request.prototype);

    function Response(bodyInit, options) {
        if (!(this instanceof Response)) {
            throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
        }
        if (!options) {
            options = {};
        }

        this.type = 'default';
        this.status = options.status === undefined ? 200 : options.status;
        this.ok = this.status >= 200 && this.status < 300;
        this.statusText = 'statusText' in options ? options.statusText : '';
        this.headers = new Headers(options.headers);
        this.url = options.url || '';
        this._initBody(bodyInit);
    }

    Body.call(Response.prototype);

    Response.prototype.clone = function() {
        return new Response(this._bodyInit, {
            status: this.status,
            statusText: this.statusText,
            headers: new Headers(this.headers),
            url: this.url
        })
    };

    Response.error = function() {
        var response = new Response(null, {status: 0, statusText: ''});
        response.type = 'error';
        return response
    };

    var redirectStatuses = [301, 302, 303, 307, 308];

    Response.redirect = function(url, status) {
        if (redirectStatuses.indexOf(status) === -1) {
            throw new RangeError('Invalid status code')
        }

        return new Response(null, {status: status, headers: {location: url}})
    };

    exports.DOMException = global.DOMException;
    try {
        new exports.DOMException();
    } catch (err) {
        exports.DOMException = function(message, name) {
            this.message = message;
            this.name = name;
            var error = Error(message);
            this.stack = error.stack;
        };
        exports.DOMException.prototype = Object.create(Error.prototype);
        exports.DOMException.prototype.constructor = exports.DOMException;
    }

    function fetch(input, init) {
        return new Promise(function(resolve, reject) {
            var request = new Request(input, init);

            if (request.signal && request.signal.aborted) {
                return reject(new exports.DOMException('Aborted', 'AbortError'))
            }

            var xhr = new XMLHttpRequest();

            function abortXhr() {
                xhr.abort();
            }

            xhr.onload = function() {
                var options = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: parseHeaders(xhr.getAllResponseHeaders() || '')
                };
                options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
                var body = 'response' in xhr ? xhr.response : xhr.responseText;
                setTimeout(function() {
                    resolve(new Response(body, options));
                }, 0);
            };

            xhr.onerror = function() {
                setTimeout(function() {
                    reject(new TypeError('Network request failed'));
                }, 0);
            };

            xhr.ontimeout = function() {
                setTimeout(function() {
                    reject(new TypeError('Network request failed'));
                }, 0);
            };

            xhr.onabort = function() {
                setTimeout(function() {
                    reject(new exports.DOMException('Aborted', 'AbortError'));
                }, 0);
            };

            function fixUrl(url) {
                try {
                    return url === '' && global.location.href ? global.location.href : url
                } catch (e) {
                    return url
                }
            }

            xhr.open(request.method, fixUrl(request.url), true);

            if (request.credentials === 'include') {
                xhr.withCredentials = true;
            } else if (request.credentials === 'omit') {
                xhr.withCredentials = false;
            }

            if ('responseType' in xhr) {
                if (support.blob) {
                    xhr.responseType = 'blob';
                } else if (
                    support.arrayBuffer &&
                    request.headers.get('Content-Type') &&
                    request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
                ) {
                    xhr.responseType = 'arraybuffer';
                }
            }

            if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
                Object.getOwnPropertyNames(init.headers).forEach(function(name) {
                    xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
                });
            } else {
                request.headers.forEach(function(value, name) {
                    xhr.setRequestHeader(name, value);
                });
            }

            if (request.signal) {
                request.signal.addEventListener('abort', abortXhr);

                xhr.onreadystatechange = function() {
                    // DONE (success or failure)
                    if (xhr.readyState === 4) {
                        request.signal.removeEventListener('abort', abortXhr);
                    }
                };
            }

            xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
        })
    }

    fetch.polyfill = true;

    if (!global.fetch) {
        global.fetch = fetch;
        global.Headers = Headers;
        global.Request = Request;
        global.Response = Response;
    }

    exports.Headers = Headers;
    exports.Request = Request;
    exports.Response = Response;
    exports.fetch = fetch;

    Object.defineProperty(exports, '__esModule', { value: true });

})));


//////////////////////////fetch-polyfill-ends////////////////////////////////////




//////////////////////////Map-polyfill////////////////////////////////////

/**
 * By anonyco:
 * https://github.com/anonyco/Javascript-Fast-Light-Map-WeakMap-Set-And-WeakSet-JS-Polyfill
 */
"undefined" != typeof Map && Map.prototype.keys && "undefined" != typeof Set && Set.prototype.keys || function () {
    "use-strict";

    function t(t, e) {
        if (e === e) return t.indexOf(e);
        for (i = 0, n = t.length; t[i] === t[i] && ++i !== n;) ;
        return i
    }

    var e, i, n, r, s, o, h = {
        "delete": function (i) {
            return e = t(this.k, i), ~e ? (this.k.splice(e, 1), this.v.splice(e, 1), --this.size, !0) : !1
        }, get: function (e) {
            return this.v[t(this.k, e)]
        }, set: function (i, n) {
            return e = t(this.k, i), ~e || (this.k[e = this.size++] = i), this.v[e] = n, this
        }, has: function (e) {
            return t(this.k, e) > -1
        }, clear: function () {
            this.k.length = this.v.length = this.size = 0
        }, forEach: function (t, e) {
            e && (t = t.bind(e));
            for (var i = -1, n = this.size; ++i !== n;) t(this.v[i], this.k[i], this)
        }, entries: function () {
            var t = 0, e = this;
            return {
                next: function () {
                    return t !== e.size ? {value: [e.k[t++], e.v[t]], done: !1} : {done: !0}
                }
            }
        }, keys: function () {
            var t = 0, e = this;
            return {
                next: function () {
                    return t !== e.size ? {value: e.k[t++], done: !1} : {done: !0}
                }
            }
        }, values: function () {
            var t = 0, e = this;
            return {
                next: function () {
                    return t !== e.size ? {value: e.v[t++], done: !1} : {done: !0}
                }
            }
        }, toString: function () {
            return "[object Map]"
        }
    };
    WeakMap = Map = function (e) {
        if (r = this.k = [], s = this.v = [], n = 0, void 0 !== e && null !== e) {
            if (o = Object(e), i = +o.length, i != i) throw new TypeError("(" + (e.toString || o.toString)() + ") is not iterable");
            for (; i--;) {
                if (!(o[i] instanceof Object)) throw new TypeError("Iterator value " + o[i] + " is not an entry object");
                ~t(r, o[i][0]) || (r[n] = o[i][0], s[n++] = o[i][1])
            }
            r.reverse(), s.reverse()
        }
        this.size = n
    }, Map.prototype = h, WeakSet = Set = function (e) {
        if (r = this.k = this.v = [], n = 0, void 0 !== e && null !== e) {
            if (o = Object(e), i = +o.length, i != i) throw new TypeError("(" + (e.toString || o.toString)() + ") is not iterable");
            for (; i--;) ~t(r, o[i]) || (r[n++] = o[i]);
            r.reverse()
        }
        this.size = n
    }, Set.prototype = {
        "delete": function (i) {
            return e = t(this.k, i), ~e ? (this.k.splice(e, 1), --this.size, !0) : !1
        },
        add: function (i) {
            return e = t(this.k, i), ~e || (e = this.size++), this.k[e] = i, this
        },
        has: h.has,
        clear: h.clear,
        forEach: h.forEach,
        entries: h.entries,
        keys: h.keys,
        values: h.keys,
        toString: function () {
            return "[object Set]"
        }
    }
}();

//////////////////////////Map-polyfill-ends////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////
// Bridged Worker... https://github.com/blittle/bridged-worker, originally authored at https://gist.github.com/d1manson/6714892
var BuildBridgedWorker = function (workerFunction, workerExportNames, mainExportNames, mainExportHandles) {

    var baseWorkerStr = workerFunction.toString().match(/^\s*function\s*\(\s*\)\s*\{(([\s\S](?!\}$))*[\s\S])/)[1];
    var extraWorkerStr = [];

    // build a string for the worker end of the worker-calls-function-in-main-thread operation
    extraWorkerStr.push("var main = {};\n");
    for (var i = 0; i < mainExportNames.length; i++) {
        var name = mainExportNames[i];
        if (name.charAt(name.length - 1) === "*") {
            name = name.substr(0, name.length - 1);
            mainExportNames[i] = name;//we need this trimmed version back in main
            extraWorkerStr.push("main." + name + " = function(/* arguments */){\n var args = Array.prototype.slice.call(arguments); var buffers = args.pop(); \n self.postMessage({foo:'" + name + "', args:args},buffers)\n}; \n");
        } else {
            extraWorkerStr.push("main." + name + " = function(/* arguments */){\n var args = Array.prototype.slice.call(arguments); \n self.postMessage({foo:'" + name + "', args:args})\n}; \n");
        }
    }

    // build a string for the worker end of the main-thread-calls-function-in-worker operation
    var tmpStr = [];
    for (var i = 0; i < workerExportNames.length; i++) {
        var name = workerExportNames[i];
        name = name.charAt(name.length - 1) === "*" ? name.substr(0, name.length - 1) : name;
        tmpStr.push(name + ": " + name);
    }
    extraWorkerStr.push("var foos={" + tmpStr.join(",") + "};\n");
    extraWorkerStr.push("self.onmessage = function(e){\n");
    extraWorkerStr.push("if(e.data.foo in foos) \n  foos[e.data.foo].apply(null, e.data.args); \n else \n throw(new Error('Main thread requested function ' + e.data.foo + '. But it is not available.'));\n");
    extraWorkerStr.push("\n};\n");

    var fullWorkerStr = baseWorkerStr + "\n\n/*==== AUTO-GENERATED-CODE ==== */\n\n" + extraWorkerStr.join("");

    // create the worker
    var blob;
    try {
        blob = new Blob([fullWorkerStr], {type: 'text/javascript'});
    } catch (e) { // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(fullWorkerStr);
        blob = blob.getBlob();
    }
    var url = (window.URL ? URL : webkitURL).createObjectURL(blob);
    var worker = new Worker(url);

    // build a function for the main part of worker-calls-function-in-main-thread operation
    worker.onmessage = function (e) {
        var fooInd = mainExportNames.indexOf(e.data.foo);
        if (fooInd !== -1) {
            mainExportHandles[fooInd].apply(null, e.data.args);
        } else {
            throw(new Error("Worker requested function " + e.data.foo + ". But it is not available."));
        }
    }

    // build an array of functions for the main part of main-thread-calls-function-in-worker operation
    var ret = {blobURL: url};//this is useful to know for debugging if you have loads of bridged workers in blobs with random names
    var makePostMessageForFunction = function (name, hasBuffers) {
        if (hasBuffers)
            return function (/*args...,[ArrayBuffer,..]*/) {
                var args = Array.prototype.slice.call(arguments);
                var buffers = args.pop();
                worker.postMessage({foo: name, args: args}, buffers);
            }
        else
            return function (/*args...*/) {
                var args = Array.prototype.slice.call(arguments);
                worker.postMessage({foo: name, args: args});
            };
    }

    for (var i = 0; i < workerExportNames.length; i++) {
        var name = workerExportNames[i];
        if (name.charAt(name.length - 1) === "*") {
            name = name.substr(0, name.length - 1);
            ret[name] = makePostMessageForFunction(name, true);
        } else {
            ret[name] = makePostMessageForFunction(name, false);
        }
    }

    return ret; //we return an object which lets the main thread call the worker.  The object will take care of the communication in the other direction.
};

/////////////////////////////////////Bridged-Worker Ends/////////////////////////////////////////////////////