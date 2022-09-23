let BODY_ID = 'sys_main';
let GUIDE_CLASS = 'guideline';
let MIN_BIAS = 0.0000000001;

const styleSheet = document.createElement('style');
styleSheet.setAttribute('type', 'text/css');


let page;

let projectURL, scriptURL;
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
function RemoteLayoutData(path) {
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
    if (this === page) {
        let layoutObj = layoutCode();
        if (layoutObj) {
            this.layoutFromSheet(this.rootElement);
        } else {
            this.layoutFromTags(this.rootElement);
        }
    } else {
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
                if (isPopup === true) {
                    disPage.popups.set(root.id, popupData);
                } else {
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
                if (disPage.srcPaths.length > 0) {
                    var worker = BuildBridgedWorker(workerCode, ["loadAll"], ["layoutLoaded", "layoutError"], [layoutLoaded, layoutError]);
                    worker.loadAll(projectURL, disPage.srcPaths);
                } else {
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
                if (attr === attrKeys.layout_popup) {
                    isPopup = true;
                }
            } else {
                throw 'invalid constraint definition... no colon found in ' + con + " on " + root.id;
            }
        }
        if (src) {
            let popupData = new RemoteLayoutData(src);
            if (isPopup === true) {
                disPage.popups.set(root.id, popupData);
            } else {
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
                if (disPage.srcPaths.length > 0) {
                    var worker = BuildBridgedWorker(workerCode, ["loadAll"], ["layoutLoaded", "layoutError"], [layoutLoaded, layoutError]);
                    worker.loadAll(projectURL, disPage.srcPaths);
                } else {
                    disPage.sourcesLoaded = true;
                }
            }
        }
    }

};


Page.prototype.buildUI = function (rootView) {
    let bgEnabledViews = [];
    let pops = [];
    let layAll = function (v, page) {
        if (v.childrenIds.length > 0) {
            autoLayout(v.htmlNode === document.body ? undefined : v.htmlNode, v.layoutChildren(page));
            v.childrenIds.forEach(function (id) {
                let cv = page.viewMap.get(id);
                if (cv.isPopup()) {
                    pops.push(cv);
                }
                if (cv.hasBgImage) {
                    bgEnabledViews.push(cv);
                }
                if (cv.childrenIds.length > 0) {
                    layAll(cv, page);
                }
            });
        }
    };
    layAll(rootView, this);
    bgEnabledViews.forEach(function (child) {
        child.makeBgImage();
    });

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
Page.prototype.openPopup = function (popupId, closeOnClickOutSide) {
    let pg = this;
    let ppData = this.popups.get(popupId);

    let html = this.sources.get(ppData.path);
    let r = ppData.rect;
    if (!r || !r.width || !r.height) {
        throw 'specify width or height on popup: ' + popupId;
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
Page.prototype.closePopup = function (popup) {
    popup.hide();
};

/**
 *
 * Render the included html in its include
 * @param includeID The id of the layout that the included html will be attached to
 * @param htmlContent The html sublayout
 */
Page.prototype.renderInclude = function (includeID, htmlContent) {
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

    function loadAll(basePath, files) {
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

        const absolute = new URL(layoutFile, basePath)
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
                            r[e] = { status: "rejected", reason: n }, 0 == --i && t(r)
                        })
                    }
                    r[e] = { status: "fulfilled", value: n }, 0 == --i && t(r)
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
                    return { done: value === undefined, value: value }
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
            return new Request(this, { body: this._bodyInit })
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
            var response = new Response(null, { status: 0, statusText: '' });
            response.type = 'error';
            return response
        };

        var redirectStatuses = [301, 302, 303, 307, 308];

        Response.redirect = function (url, status) {
            if (redirectStatuses.indexOf(status) === -1) {
                throw new RangeError('Invalid status code')
            }

            return new Response(null, { status: status, headers: { location: url } })
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

        Object.defineProperty(exports, '__esModule', { value: true });

    })));

    //////////////////////////fetch-polyfill-ends////////////////////////////////////
};

var layoutLoaded = function (filePath, htmlContent, allLoaded) {
    //  console.log('layoutLoaded:--> ', 'filepath: ', filePath, ", layout: ", htmlContent, ", allLoaded: ", allLoaded);
    page.sources.set(filePath, htmlContent);
    page.includes.forEach(function (layoutData, id) {
        if (layoutData.consumed === false) {
            if (layoutData.path === filePath) {
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
        view.addConstraints(AutoLayout.VisualFormat.parse(constraints, { extended: true }));
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

        enforceSameUnitsOnMargins: {
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

View.prototype.isPopup = function () {
    let check = this.refIds.get(attrKeys.layout_popup);
    return typeof check !== "undefined" && (check === true || check === 'true');
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
    orientation: "orient", //

    mi_useAutoBg: "mi-use-bg",//bool.. if true, will enable automatic backgrounds
    mi_mode: "mi-mode", //
    mi_fontStyle: "mi-font-st",
    mi_fontName: "mi-font-nm",
    mi_fontWeight: "mi-font-wt",
    mi_fontSize: "mi-font-sz",
    mi_shapesDensity: "mi-shapes-density",

    mi_opacity: "mi-opacity",
    mi_fg: "mi-fg",
    mi_bg: "mi-bg",
    mi_opaqueBg: "mi-opq-bg",//allow the opacity to affect the background color also.
    mi_strokeWidth: "mi-sw",
    mi_minSize: "mi-min-sz",
    mi_numShapes: "mi-num-shapes",
    mi_textOnly: "mi-text-only",// bool
    mi_textArray: "mi-text-arr",//'["NGN","GBP","USD","EUR","CAD"]'
    mi_cacheAfterDraw: "mi-cache-image",//bool

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
 * Credits to http://jsfiddle.net/slavafomin/tsrmgcu9/
 * @return {number}
 */
function getScrollBarWidth() {
    // Creating invisible container
    var outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll'; // forcing scrollbar to appear
    outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
    document.body.appendChild(outer);

    // Creating inner element and placing it in the container
    var inner = document.createElement('div');
    outer.appendChild(inner);

    // Calculating difference between container's full width and the child width
    var scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

    // Removing temporary elements from the DOM
    outer.parentNode.removeChild(outer);

    return scrollbarWidth;

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
        return { number: null, units: null };
    }
    if (isNumber(val)) {
        if (seeNoUnitsAsPx && seeNoUnitsAsPx === true) {
            return { number: val, units: "px" };
        } else {
            return { number: null, units: null };
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
        return { number: null, units: null };
    }
    if (!isNumber(number)) {
        return { number: null, units: null };
    }
    return { number: number, units: units };
}


function getUrls() {
    let scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
        let script = scripts[i];
        let src = script.src;
        let ender = 'layman-extra.js';
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
    if (typeof options.closeOnClickOutside === "boolean") {
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
        if (popup.closeOnClickOutside) {
            popup.hide();
        }
    };


    if (dialog) {
        dialog.style.display = 'block';
    } else {
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
            setStyle(shrinkChild, { width: '200%', height: '200%' });
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

    Object.defineProperty(exports, '__esModule', { value: true });

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
                var l = n[o] = { exports: {} };
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
                        peg$startRuleFunctions = { visualFormatString: peg$parsevisualFormatString },
                        peg$startRuleFunction = peg$parsevisualFormatString,
                        peg$c0 = peg$FAILED,
                        peg$c1 = null,
                        peg$c2 = ":",
                        peg$c3 = { type: "literal", value: ":", description: "\":\"" },
                        peg$c4 = [],
                        peg$c5 = function peg$c5(o, superto, view, views, tosuper) {
                            return {
                                orientation: o ? o[0] : 'horizontal',
                                cascade: (superto || []).concat([view], [].concat.apply([], views), tosuper || [])
                            };
                        },
                        peg$c6 = "H",
                        peg$c7 = { type: "literal", value: "H", description: "\"H\"" },
                        peg$c8 = "V",
                        peg$c9 = { type: "literal", value: "V", description: "\"V\"" },
                        peg$c10 = function peg$c10(orient) {
                            return orient == 'H' ? 'horizontal' : 'vertical';
                        },
                        peg$c11 = "|",
                        peg$c12 = { type: "literal", value: "|", description: "\"|\"" },
                        peg$c13 = function peg$c13() {
                            return { view: null };
                        },
                        peg$c14 = "[",
                        peg$c15 = { type: "literal", value: "[", description: "\"[\"" },
                        peg$c16 = "]",
                        peg$c17 = { type: "literal", value: "]", description: "\"]\"" },
                        peg$c18 = function peg$c18(view, predicates) {
                            return extend(view, predicates ? { constraints: predicates } : {});
                        },
                        peg$c19 = "-",
                        peg$c20 = { type: "literal", value: "-", description: "\"-\"" },
                        peg$c21 = function peg$c21(predicateList) {
                            return predicateList;
                        },
                        peg$c22 = function peg$c22() {
                            return [{ relation: 'equ', constant: 'default', $parserOffset: offset() }];
                        },
                        peg$c23 = "",
                        peg$c24 = function peg$c24() {
                            return [{ relation: 'equ', constant: 0, $parserOffset: offset() }];
                        },
                        peg$c25 = function peg$c25(n) {
                            return [{ relation: 'equ', constant: n, $parserOffset: offset() }];
                        },
                        peg$c26 = "(",
                        peg$c27 = { type: "literal", value: "(", description: "\"(\"" },
                        peg$c28 = ",",
                        peg$c29 = { type: "literal", value: ",", description: "\",\"" },
                        peg$c30 = ")",
                        peg$c31 = { type: "literal", value: ")", description: "\")\"" },
                        peg$c32 = function peg$c32(p, ps) {
                            return [p].concat(ps.map(function (p) {
                                return p[1];
                            }));
                        },
                        peg$c33 = "@",
                        peg$c34 = { type: "literal", value: "@", description: "\"@\"" },
                        peg$c35 = function peg$c35(r, o, p) {
                            return extend({ relation: 'equ' }, r || {}, o, p ? p[1] : {});
                        },
                        peg$c36 = "==",
                        peg$c37 = { type: "literal", value: "==", description: "\"==\"" },
                        peg$c38 = function peg$c38() {
                            return { relation: 'equ', $parserOffset: offset() };
                        },
                        peg$c39 = "<=",
                        peg$c40 = { type: "literal", value: "<=", description: "\"<=\"" },
                        peg$c41 = function peg$c41() {
                            return { relation: 'leq', $parserOffset: offset() };
                        },
                        peg$c42 = ">=",
                        peg$c43 = { type: "literal", value: ">=", description: "\">=\"" },
                        peg$c44 = function peg$c44() {
                            return { relation: 'geq', $parserOffset: offset() };
                        },
                        peg$c45 = /^[0-9]/,
                        peg$c46 = { type: "class", value: "[0-9]", description: "[0-9]" },
                        peg$c47 = function peg$c47(digits) {
                            return { priority: parseInt(digits.join(""), 10) };
                        },
                        peg$c48 = function peg$c48(n) {
                            return { constant: n };
                        },
                        peg$c49 = /^[a-zA-Z_]/,
                        peg$c50 = { type: "class", value: "[a-zA-Z_]", description: "[a-zA-Z_]" },
                        peg$c51 = /^[a-zA-Z0-9_]/,
                        peg$c52 = { type: "class", value: "[a-zA-Z0-9_]", description: "[a-zA-Z0-9_]" },
                        peg$c53 = function peg$c53(f, v) {
                            return { view: f + v };
                        },
                        peg$c54 = ".",
                        peg$c55 = { type: "literal", value: ".", description: "\".\"" },
                        peg$c56 = function peg$c56(digits, decimals) {
                            return parseFloat(digits.concat(".").concat(decimals).join(""), 10);
                        },
                        peg$c57 = function peg$c57(digits) {
                            return parseInt(digits.join(""), 10);
                        },
                        peg$currPos = 0,
                        peg$reportedPos = 0,
                        peg$cachedPos = 0,
                        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
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
                        throw peg$buildException(null, [{ type: "other", description: description }], peg$reportedPos);
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
                                peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
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
                            peg$fail({ type: "end", description: "end of input" });
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
                        peg$startRuleFunctions = { visualFormatStringExt: peg$parsevisualFormatStringExt },
                        peg$startRuleFunction = peg$parsevisualFormatStringExt,
                        peg$c0 = peg$FAILED,
                        peg$c1 = "C:",
                        peg$c2 = { type: "literal", value: "C:", description: "\"C:\"" },
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
                            return { attr: attr, predicates: predicates };
                        },
                        peg$c7 = ":",
                        peg$c8 = { type: "literal", value: ":", description: "\":\"" },
                        peg$c9 = function peg$c9(o, superto, view, views, tosuper, comments) {
                            return {
                                type: 'vfl',
                                orientation: o ? o[0] : 'horizontal',
                                cascade: (superto || []).concat(view, [].concat.apply([], views), tosuper || [])
                            };
                        },
                        peg$c10 = "HV",
                        peg$c11 = { type: "literal", value: "HV", description: "\"HV\"" },
                        peg$c12 = function peg$c12() {
                            return 'horzvert';
                        },
                        peg$c13 = "H",
                        peg$c14 = { type: "literal", value: "H", description: "\"H\"" },
                        peg$c15 = function peg$c15() {
                            return 'horizontal';
                        },
                        peg$c16 = "V",
                        peg$c17 = { type: "literal", value: "V", description: "\"V\"" },
                        peg$c18 = function peg$c18() {
                            return 'vertical';
                        },
                        peg$c19 = "Z",
                        peg$c20 = { type: "literal", value: "Z", description: "\"Z\"" },
                        peg$c21 = function peg$c21() {
                            return 'zIndex';
                        },
                        peg$c22 = " ",
                        peg$c23 = { type: "literal", value: " ", description: "\" \"" },
                        peg$c24 = "//",
                        peg$c25 = { type: "literal", value: "//", description: "\"//\"" },
                        peg$c26 = { type: "any", description: "any character" },
                        peg$c27 = "|",
                        peg$c28 = { type: "literal", value: "|", description: "\"|\"" },
                        peg$c29 = function peg$c29() {
                            return { view: null };
                        },
                        peg$c30 = "[",
                        peg$c31 = { type: "literal", value: "[", description: "\"[\"" },
                        peg$c32 = ",",
                        peg$c33 = { type: "literal", value: ",", description: "\",\"" },
                        peg$c34 = "]",
                        peg$c35 = { type: "literal", value: "]", description: "\"]\"" },
                        peg$c36 = function peg$c36(view, views) {
                            return views.length ? [view].concat([].concat.apply([], views)) : view;
                        },
                        peg$c37 = function peg$c37(view, predicates, cascadedViews) {
                            return extend(extend(view, predicates ? { constraints: predicates } : {}), cascadedViews ? {
                                cascade: cascadedViews
                            } : {});
                        },
                        peg$c38 = function peg$c38(views, connection) {
                            return [].concat([].concat.apply([], views), [connection]);
                        },
                        peg$c39 = "->",
                        peg$c40 = { type: "literal", value: "->", description: "\"->\"" },
                        peg$c41 = function peg$c41() {
                            return [{ relation: 'none' }];
                        },
                        peg$c42 = "-",
                        peg$c43 = { type: "literal", value: "-", description: "\"-\"" },
                        peg$c44 = function peg$c44(predicateList) {
                            return predicateList;
                        },
                        peg$c45 = function peg$c45() {
                            return [{ relation: 'equ', constant: 'default' }];
                        },
                        peg$c46 = "~",
                        peg$c47 = { type: "literal", value: "~", description: "\"~\"" },
                        peg$c48 = function peg$c48() {
                            return [{ relation: 'equ', equalSpacing: true }];
                        },
                        peg$c49 = "",
                        peg$c50 = function peg$c50() {
                            return [{ relation: 'equ', constant: 0 }];
                        },
                        peg$c51 = function peg$c51(p) {
                            return [{ relation: 'equ', multiplier: p.multiplier }];
                        },
                        peg$c52 = function peg$c52(n) {
                            return [{ relation: 'equ', constant: n }];
                        },
                        peg$c53 = "(",
                        peg$c54 = { type: "literal", value: "(", description: "\"(\"" },
                        peg$c55 = ")",
                        peg$c56 = { type: "literal", value: ")", description: "\")\"" },
                        peg$c57 = function peg$c57(p, ps) {
                            return [p].concat(ps.map(function (p) {
                                return p[1];
                            }));
                        },
                        peg$c58 = "@",
                        peg$c59 = { type: "literal", value: "@", description: "\"@\"" },
                        peg$c60 = function peg$c60(r, o, p) {
                            return extend({ relation: 'equ' }, r || {}, o, p ? p[1] : {});
                        },
                        peg$c61 = function peg$c61(r, o, p) {
                            return extend({ relation: 'equ', equalSpacing: true }, r || {}, o, p ? p[1] : {});
                        },
                        peg$c62 = "==",
                        peg$c63 = { type: "literal", value: "==", description: "\"==\"" },
                        peg$c64 = function peg$c64() {
                            return { relation: 'equ' };
                        },
                        peg$c65 = "<=",
                        peg$c66 = { type: "literal", value: "<=", description: "\"<=\"" },
                        peg$c67 = function peg$c67() {
                            return { relation: 'leq' };
                        },
                        peg$c68 = ">=",
                        peg$c69 = { type: "literal", value: ">=", description: "\">=\"" },
                        peg$c70 = function peg$c70() {
                            return { relation: 'geq' };
                        },
                        peg$c71 = /^[0-9]/,
                        peg$c72 = { type: "class", value: "[0-9]", description: "[0-9]" },
                        peg$c73 = function peg$c73(digits) {
                            return { priority: parseInt(digits.join(""), 10) };
                        },
                        peg$c74 = function peg$c74(n) {
                            return { constant: n };
                        },
                        peg$c75 = function peg$c75(n) {
                            return { constant: -n };
                        },
                        peg$c76 = "+",
                        peg$c77 = { type: "literal", value: "+", description: "\"+\"" },
                        peg$c78 = "%",
                        peg$c79 = { type: "literal", value: "%", description: "\"%\"" },
                        peg$c80 = function peg$c80(n) {
                            return { view: null, multiplier: n / 100 };
                        },
                        peg$c81 = function peg$c81(n) {
                            return { view: null, multiplier: n / -100 };
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
                        peg$c84 = { type: "literal", value: ".left", description: "\".left\"" },
                        peg$c85 = function peg$c85() {
                            return 'left';
                        },
                        peg$c86 = ".right",
                        peg$c87 = { type: "literal", value: ".right", description: "\".right\"" },
                        peg$c88 = function peg$c88() {
                            return 'right';
                        },
                        peg$c89 = ".top",
                        peg$c90 = { type: "literal", value: ".top", description: "\".top\"" },
                        peg$c91 = function peg$c91() {
                            return 'top';
                        },
                        peg$c92 = ".bottom",
                        peg$c93 = { type: "literal", value: ".bottom", description: "\".bottom\"" },
                        peg$c94 = function peg$c94() {
                            return 'bottom';
                        },
                        peg$c95 = ".width",
                        peg$c96 = { type: "literal", value: ".width", description: "\".width\"" },
                        peg$c97 = function peg$c97() {
                            return 'width';
                        },
                        peg$c98 = ".height",
                        peg$c99 = { type: "literal", value: ".height", description: "\".height\"" },
                        peg$c100 = function peg$c100() {
                            return 'height';
                        },
                        peg$c101 = ".centerX",
                        peg$c102 = { type: "literal", value: ".centerX", description: "\".centerX\"" },
                        peg$c103 = function peg$c103() {
                            return 'centerX';
                        },
                        peg$c104 = ".centerY",
                        peg$c105 = { type: "literal", value: ".centerY", description: "\".centerY\"" },
                        peg$c106 = function peg$c106() {
                            return 'centerY';
                        },
                        peg$c107 = "/",
                        peg$c108 = { type: "literal", value: "/", description: "\"/\"" },
                        peg$c109 = function peg$c109(n) {
                            return 1 / n;
                        },
                        peg$c110 = "/+",
                        peg$c111 = { type: "literal", value: "/+", description: "\"/+\"" },
                        peg$c112 = "/-",
                        peg$c113 = { type: "literal", value: "/-", description: "\"/-\"" },
                        peg$c114 = function peg$c114(n) {
                            return -1 / n;
                        },
                        peg$c115 = "*",
                        peg$c116 = { type: "literal", value: "*", description: "\"*\"" },
                        peg$c117 = function peg$c117(n) {
                            return n;
                        },
                        peg$c118 = "*+",
                        peg$c119 = { type: "literal", value: "*+", description: "\"*+\"" },
                        peg$c120 = "*-",
                        peg$c121 = { type: "literal", value: "*-", description: "\"*-\"" },
                        peg$c122 = function peg$c122(n) {
                            return -n;
                        },
                        peg$c123 = /^[a-zA-Z_]/,
                        peg$c124 = { type: "class", value: "[a-zA-Z_]", description: "[a-zA-Z_]" },
                        peg$c125 = /^[a-zA-Z0-9_]/,
                        peg$c126 = { type: "class", value: "[a-zA-Z0-9_]", description: "[a-zA-Z0-9_]" },
                        peg$c127 = function peg$c127(f, v, r) {
                            return { view: f + v, range: r, $parserOffset: offset() };
                        },
                        peg$c128 = function peg$c128(f, v) {
                            return { view: f + v, $parserOffset: offset() };
                        },
                        peg$c129 = "..",
                        peg$c130 = { type: "literal", value: "..", description: "\"..\"" },
                        peg$c131 = function peg$c131(d) {
                            return parseInt(d);
                        },
                        peg$c132 = ".",
                        peg$c133 = { type: "literal", value: ".", description: "\".\"" },
                        peg$c134 = function peg$c134(digits, decimals) {
                            return parseFloat(digits.concat(".").concat(decimals).join(""), 10);
                        },
                        peg$c135 = function peg$c135(digits) {
                            return parseInt(digits.join(""), 10);
                        },
                        peg$currPos = 0,
                        peg$reportedPos = 0,
                        peg$cachedPos = 0,
                        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
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
                        throw peg$buildException(null, [{ type: "other", description: description }], peg$reportedPos);
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
                                peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
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
                            peg$fail({ type: "end", description: "end of input" });
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
                    cascade.push({ view: stackView });
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
                                        subView = { orientations: 0 };
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
                        subView = { orientations: context.orientation };
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
                    var vr = new c.Variable({ value: value });
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

        }, { "cassowary/bin/c": 2 }], 2: [function (require, module, exports) {
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
                                this.extend(i, { upgrade: l }), h = function () {
                                    return l(a.document.createElement(k))
                                }, h.prototype = i, this.extend(h, { ctor: j })
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
                            }), { _t: "c.HashSet", data: a }
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
                            return { _t: this._t, value: this.value }
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
                                var e = { value: b };
                                d && (e.name = "x" + d), this._x = new a.Variable(e)
                            }
                            if (c instanceof a.Variable) this._y = c; else {
                                var f = { value: c };
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
                                return a.isPivotable ? { retval: a } : void 0
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
                                if (!(b instanceof a.Expression || b instanceof a.AbstractVariable || "number" == typeof b) || !(c instanceof a.Expression || c instanceof a.AbstractVariable || "number" == typeof c)) throw "Bad initializer to c.Equation";
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
                            a.Tableau.call(this), this._stayMinusErrorVars = [], this._stayPlusErrorVars = [], this._errorVars = new a.HashTable, this._markerVars = new a.HashTable, this._objective = new a.ObjectiveVariable({ name: "Z" }), this._editVarMap = new a.HashTable, this._editVarList = [], this._slackCounter = 0, this._artificialCounter = 0, this._dummyCounter = 0, this.autoSolve = !0, this._fNeedsSolving = !1, this._optimizeCount = 0, this.rows.set(this._objective, new a.Expression), this._stkCedcns = [0], a.trace && a.traceprint("objective expr == " + this.rows.get(this._objective))
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
                                this._editVarMap.set(b.variable, i), this._editVarList[f] = { v: b.variable, info: i }
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
                                    return a != this._objective ? (g = a, { brk: !0 }) : void 0
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
                            var c = new a.SlackVariable({ value: ++this._artificialCounter, prefix: "a" }),
                                d = new a.ObjectiveVariable({ name: "az" }), e = b.clone();
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
                                    if (!a.isRestricted && !this.columnsHasKey(a)) return { retval: a }
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
                                return a.isDummy ? (this.columnsHasKey(a) || (c = a, h = b), void 0) : { retval: null }
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
                                    return a.isPivotable && g > b ? (g = b, e = a, { brk: 1 }) : void 0
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
                                    return { type: "NumericLiteral", value: b }
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
                                    return { type: "Variable", name: b }
                                }(i, a)), null === a && (e = i), null === a && (a = A(), null === a && (i = e, j = e, 40 === b.charCodeAt(e) ? (a = "(", e++) : (a = null, 0 === f && k('"("')), null !== a ? (c = z(), null !== c ? (d = P(), null !== d ? (g = z(), null !== g ? (41 === b.charCodeAt(e) ? (h = ")", e++) : (h = null, 0 === f && k('")"')), null !== h ? a = [a, c, d, g, h] : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j)) : (a = null, e = j), null !== a && (a = function (a, b) {
                                    return b
                                }(i, a[2])), null === a && (e = i))), a
                            }

                            function H() {
                                var a, b, c, d, f;
                                return a = G(), null === a && (d = e, f = e, a = I(), null !== a ? (b = z(), null !== b ? (c = H(), null !== c ? a = [a, b, c] : (a = null, e = f)) : (a = null, e = f)) : (a = null, e = f), null !== a && (a = function (a, b, c) {
                                    return { type: "UnaryExpression", operator: b, expression: c }
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
                                return { line: a, column: c }
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

//AUTOLAYOUT ENDS


//////////////////////////Map-polyfill////////////////////////////////////

/**
 * By anonyco:
 * https://github.com/anonyco/Javascript-Fast-Light-Map-WeakMap-Set-And-WeakSet-JS-Polyfill
 */
"undefined" != typeof Map && Map.prototype.keys && "undefined" != typeof Set && Set.prototype.keys || function () {
    "use-strict";

    function t(t, e) {
        if (e === e) return t.indexOf(e);
        for (i = 0, n = t.length; t[i] === t[i] && ++i !== n;);
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
                    return t !== e.size ? { value: [e.k[t++], e.v[t]], done: !1 } : { done: !0 }
                }
            }
        }, keys: function () {
            var t = 0, e = this;
            return {
                next: function () {
                    return t !== e.size ? { value: e.k[t++], done: !1 } : { done: !0 }
                }
            }
        }, values: function () {
            var t = 0, e = this;
            return {
                next: function () {
                    return t !== e.size ? { value: e.v[t++], done: !1 } : { done: !0 }
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

//Canvas Polyfill
/**
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 *
 * @fileoverview Description of this file.
 *
 * A polyfill for HTML Canvas features, including
 * Path2D support.
 */

(function (CanvasRenderingContext2D, nodeRequire) {

    if (CanvasRenderingContext2D == undefined) {
        CanvasRenderingContext2D = nodeRequire('canvas').Context2d;
    }

    if (CanvasRenderingContext2D.prototype.ellipse == undefined) {
        CanvasRenderingContext2D.prototype.ellipse = function (x, y, radiusX, radiusY, rotation, startAngle, endAngle, antiClockwise) {
            this.save();
            this.translate(x, y);
            this.rotate(rotation);
            this.scale(radiusX, radiusY);
            this.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
            this.restore();
        }
    }

    if (typeof Path2D !== 'function' ||
        typeof new Path2D().addPath !== 'function') {
        (function () {

            // Include the SVG path parser.
            parser = (function () {
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

                        peg$startRuleFunctions = { svg_path: peg$parsesvg_path },
                        peg$startRuleFunction = peg$parsesvg_path,

                        peg$c0 = peg$FAILED,
                        peg$c1 = [],
                        peg$c2 = null,
                        peg$c3 = function (d) {
                            return ops;
                        },
                        peg$c4 = /^[Mm]/,
                        peg$c5 = { type: "class", value: "[Mm]", description: "[Mm]" },
                        peg$c6 = function (ch, args) {
                            var moveCh = ch
                            // If this is the first move cmd then force it to be absolute.
                            if (firstSubPath) {
                                moveCh = 'M';
                                firstSubPath = false;
                            }
                            ops.push({ type: 'moveTo', args: makeAbsolute(moveCh, args[0]) });
                            for (var i = 1; i < args.length; i++) {
                                // The lineTo args are either abs or relative, depending on the
                                // original moveto command.
                                ops.push({ type: 'lineTo', args: makeAbsolute(ch, args[i]) });
                            }
                        },
                        peg$c7 = function (one, rest) {
                            return concatSequence(one, rest);
                        },
                        peg$c8 = /^[Zz]/,
                        peg$c9 = { type: "class", value: "[Zz]", description: "[Zz]" },
                        peg$c10 = function () {
                            ops.push({ type: 'closePath', args: [] });
                        },
                        peg$c11 = /^[Ll]/,
                        peg$c12 = { type: "class", value: "[Ll]", description: "[Ll]" },
                        peg$c13 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({ type: 'lineTo', args: makeAbsolute(ch, args[i]) });
                            }
                        },
                        peg$c14 = /^[Hh]/,
                        peg$c15 = { type: "class", value: "[Hh]", description: "[Hh]" },
                        peg$c16 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({ type: 'lineTo', args: makeAbsoluteFromX(ch, args[i]) });
                            }
                        },
                        peg$c17 = /^[Vv]/,
                        peg$c18 = { type: "class", value: "[Vv]", description: "[Vv]" },
                        peg$c19 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({ type: 'lineTo', args: makeAbsoluteFromY(ch, args[i]) });
                            }
                        },
                        peg$c20 = /^[Cc]/,
                        peg$c21 = { type: "class", value: "[Cc]", description: "[Cc]" },
                        peg$c22 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({ type: 'bezierCurveTo', args: makeAbsoluteMultiple(ch, args[i]) });
                            }
                        },
                        peg$c23 = function (cp1, cp2, last) {
                            return cp1.concat(cp2, last);
                        },
                        peg$c24 = /^[Ss]/,
                        peg$c25 = { type: "class", value: "[Ss]", description: "[Ss]" },
                        peg$c26 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({
                                    type: 'bezierCurveTo',
                                    args: makeReflected().concat(makeAbsoluteMultiple(ch, args[i]))
                                });
                            }
                        },
                        peg$c27 = function (cp1, last) {
                            return cp1.concat(last);
                        },
                        peg$c28 = /^[Qq]/,
                        peg$c29 = { type: "class", value: "[Qq]", description: "[Qq]" },
                        peg$c30 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                ops.push({ type: 'quadraticCurveTo', args: makeAbsoluteMultiple(ch, args[i]) });
                            }
                        },
                        peg$c31 = /^[Tt]/,
                        peg$c32 = { type: "class", value: "[Tt]", description: "[Tt]" },
                        peg$c33 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                var reflected = makeReflected();
                                ops.push({
                                    type: 'quadraticCurveTo',
                                    args: reflected.concat(makeAbsoluteMultiple(ch, args[i]))
                                });
                                lastControl = reflected.slice(0);
                            }
                        },
                        peg$c34 = /^[Aa]/,
                        peg$c35 = { type: "class", value: "[Aa]", description: "[Aa]" },
                        peg$c36 = function (ch, args) {
                            for (var i = 0; i < args.length; i++) {
                                var x1 = [lastCoord.slice()];
                                var x2 = [makeAbsolute(ch, args[i].slice(-2))];
                                absArgs = x1.concat(args[i].slice(0, -2), x2);
                                ellipseFromEllipticalArc.apply(this, absArgs);
                            }
                        },
                        peg$c37 = function (rx, ry, xrot, large, sweep, last) {
                            return [parseFloat(rx), parseFloat(ry), parseFloat(flatten(xrot).join('')), parseInt(large), parseInt(sweep), last[0], last[1]];
                        },
                        peg$c38 = function (x, y) {
                            return [x, y]
                        },
                        peg$c39 = function (number) {
                            return parseFloat(flatten(number).join(''))
                        },
                        peg$c40 = "0",
                        peg$c41 = { type: "literal", value: "0", description: "\"0\"" },
                        peg$c42 = "1",
                        peg$c43 = { type: "literal", value: "1", description: "\"1\"" },
                        peg$c44 = ",",
                        peg$c45 = { type: "literal", value: ",", description: "\",\"" },
                        peg$c46 = ".",
                        peg$c47 = { type: "literal", value: ".", description: "\".\"" },
                        peg$c48 = /^[eE]/,
                        peg$c49 = { type: "class", value: "[eE]", description: "[eE]" },
                        peg$c50 = "+",
                        peg$c51 = { type: "literal", value: "+", description: "\"+\"" },
                        peg$c52 = "-",
                        peg$c53 = { type: "literal", value: "-", description: "\"-\"" },
                        peg$c54 = /^[0-9]/,
                        peg$c55 = { type: "class", value: "[0-9]", description: "[0-9]" },
                        peg$c56 = function (digits) {
                            return digits.join('')
                        },
                        peg$c57 = /^[ \t\n\r]/,
                        peg$c58 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },

                        peg$currPos = 0,
                        peg$reportedPos = 0,
                        peg$cachedPos = 0,
                        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
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
                        throw peg$buildException(
                            null,
                            [{ type: "other", description: description }],
                            peg$reportedPos
                        );
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
                                } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
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
                                peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
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

                                return s
                                    .replace(/\\/g, '\\\\')
                                    .replace(/"/g, '\\"')
                                    .replace(/\x08/g, '\\b')
                                    .replace(/\t/g, '\\t')
                                    .replace(/\n/g, '\\n')
                                    .replace(/\f/g, '\\f')
                                    .replace(/\r/g, '\\r')
                                    .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function (ch) {
                                        return '\\x0' + hex(ch);
                                    })
                                    .replace(/[\x10-\x1F\x80-\xFF]/g, function (ch) {
                                        return '\\x' + hex(ch);
                                    })
                                    .replace(/[\u0180-\u0FFF]/g, function (ch) {
                                        return '\\u0' + hex(ch);
                                    })
                                    .replace(/[\u1080-\uFFFF]/g, function (ch) {
                                        return '\\u' + hex(ch);
                                    });
                            }

                            var expectedDescs = new Array(expected.length),
                                expectedDesc, foundDesc, i;

                            for (i = 0; i < expected.length; i++) {
                                expectedDescs[i] = expected[i].description;
                            }

                            expectedDesc = expected.length > 1
                                ? expectedDescs.slice(0, -1).join(", ")
                                + " or "
                                + expectedDescs[expected.length - 1]
                                : expectedDescs[0];

                            foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

                            return "Expected " + expectedDesc + " but " + foundDesc + " found.";
                        }

                        var posDetails = peg$computePosDetails(pos),
                            found = pos < input.length ? input.charAt(pos) : null;

                        if (expected !== null) {
                            cleanupExpected(expected);
                        }

                        return new SyntaxError(
                            message !== null ? message : buildMessage(expected, found),
                            expected,
                            found,
                            pos,
                            posDetails.line,
                            posDetails.column
                        );
                    }

                    function peg$parsesvg_path() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = [];
                        s2 = peg$parsewsp();
                        while (s2 !== peg$FAILED) {
                            s1.push(s2);
                            s2 = peg$parsewsp();
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsemoveTo_drawTo_commandGroups();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$parsewsp();
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$parsewsp();
                                }
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c3(s2);
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

                    function peg$parsemoveTo_drawTo_commandGroups() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsemoveTo_drawTo_commandGroup();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            s4 = peg$parsewsp();
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                s4 = peg$parsewsp();
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsemoveTo_drawTo_commandGroups();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s1 = [s1, s2];
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

                    function peg$parsemoveTo_drawTo_commandGroup() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsemoveto();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            s4 = peg$parsewsp();
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                s4 = peg$parsewsp();
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsedrawto_commands();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s1 = [s1, s2];
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

                    function peg$parsedrawto_commands() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsedrawto_command();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = [];
                            s4 = peg$parsewsp();
                            while (s4 !== peg$FAILED) {
                                s3.push(s4);
                                s4 = peg$parsewsp();
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsedrawto_commands();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s1 = [s1, s2];
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

                    function peg$parsedrawto_command() {
                        var s0;

                        s0 = peg$parseclosepath();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parselineto();
                            if (s0 === peg$FAILED) {
                                s0 = peg$parsehorizontal_lineto();
                                if (s0 === peg$FAILED) {
                                    s0 = peg$parsevertical_lineto();
                                    if (s0 === peg$FAILED) {
                                        s0 = peg$parsecurveto();
                                        if (s0 === peg$FAILED) {
                                            s0 = peg$parsesmooth_curveto();
                                            if (s0 === peg$FAILED) {
                                                s0 = peg$parsequadratic_bezier_curveto();
                                                if (s0 === peg$FAILED) {
                                                    s0 = peg$parsesmooth_quadratic_bezier_curveto();
                                                    if (s0 === peg$FAILED) {
                                                        s0 = peg$parseelliptical_arc();
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsemoveto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c4.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c5);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsemoveto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c6(s1, s3);
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

                    function peg$parsemoveto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parselineto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parseclosepath() {
                        var s0, s1;

                        s0 = peg$currPos;
                        if (peg$c8.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c9);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c10();
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parselineto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c11.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c12);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parselineto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c13(s1, s3);
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

                    function peg$parselineto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parselineto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parsehorizontal_lineto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c14.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c15);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c16(s1, s3);
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

                    function peg$parsecoordinate_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsecoordinate_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parsevertical_lineto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c17.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c18);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c19(s1, s3);
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

                    function peg$parsecurveto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c20.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c21);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecurveto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c22(s1, s3);
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

                    function peg$parsecurveto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsecurveto_argument();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsecurveto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parsecurveto_argument() {
                        var s0, s1, s2, s3, s4, s5;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma_wsp();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate_pair();
                                if (s3 !== peg$FAILED) {
                                    s4 = peg$parsecomma_wsp();
                                    if (s4 === peg$FAILED) {
                                        s4 = peg$c2;
                                    }
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$parsecoordinate_pair();
                                        if (s5 !== peg$FAILED) {
                                            peg$reportedPos = s0;
                                            s1 = peg$c23(s1, s3, s5);
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

                    function peg$parsesmooth_curveto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c24.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c25);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsesmooth_curveto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c26(s1, s3);
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

                    function peg$parsesmooth_curveto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsesmooth_curveto_argument();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsesmooth_curveto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parsesmooth_curveto_argument() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma_wsp();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate_pair();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c27(s1, s3);
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

                    function peg$parsequadratic_bezier_curveto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c28.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c29);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsequadratic_bezier_curveto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c30(s1, s3);
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

                    function peg$parsequadratic_bezier_curveto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsequadratic_bezier_curveto_argument();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsequadratic_bezier_curveto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parsequadratic_bezier_curveto_argument() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma_wsp();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate_pair();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c27(s1, s3);
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

                    function peg$parsesmooth_quadratic_bezier_curveto() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c31.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c32);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsesmooth_quadratic_bezier_curveto_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c33(s1, s3);
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

                    function peg$parsesmooth_quadratic_bezier_curveto_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate_pair();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parsesmooth_quadratic_bezier_curveto_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parseelliptical_arc() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c34.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c35);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = [];
                            s3 = peg$parsewsp();
                            while (s3 !== peg$FAILED) {
                                s2.push(s3);
                                s3 = peg$parsewsp();
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parseelliptical_arc_argument_sequence();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c36(s1, s3);
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

                    function peg$parseelliptical_arc_argument_sequence() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = peg$parseelliptical_arc_argument();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$currPos;
                            s3 = peg$parsecomma_wsp();
                            if (s3 === peg$FAILED) {
                                s3 = peg$c2;
                            }
                            if (s3 !== peg$FAILED) {
                                s4 = peg$parseelliptical_arc_argument_sequence();
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
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                peg$reportedPos = s0;
                                s1 = peg$c7(s1, s2);
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

                    function peg$parseelliptical_arc_argument() {
                        var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

                        s0 = peg$currPos;
                        s1 = peg$parsenonnegative_number();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma_wsp();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsenonnegative_number();
                                if (s3 !== peg$FAILED) {
                                    s4 = peg$parsecomma_wsp();
                                    if (s4 === peg$FAILED) {
                                        s4 = peg$c2;
                                    }
                                    if (s4 !== peg$FAILED) {
                                        s5 = peg$parsenumber();
                                        if (s5 !== peg$FAILED) {
                                            s6 = peg$parsecomma_wsp();
                                            if (s6 !== peg$FAILED) {
                                                s7 = peg$parseflag();
                                                if (s7 !== peg$FAILED) {
                                                    s8 = peg$parsecomma_wsp();
                                                    if (s8 === peg$FAILED) {
                                                        s8 = peg$c2;
                                                    }
                                                    if (s8 !== peg$FAILED) {
                                                        s9 = peg$parseflag();
                                                        if (s9 !== peg$FAILED) {
                                                            s10 = peg$parsecomma_wsp();
                                                            if (s10 === peg$FAILED) {
                                                                s10 = peg$c2;
                                                            }
                                                            if (s10 !== peg$FAILED) {
                                                                s11 = peg$parsecoordinate_pair();
                                                                if (s11 !== peg$FAILED) {
                                                                    peg$reportedPos = s0;
                                                                    s1 = peg$c37(s1, s3, s5, s7, s9, s11);
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

                    function peg$parsecoordinate_pair() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parsecoordinate();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma_wsp();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsecoordinate();
                                if (s3 !== peg$FAILED) {
                                    peg$reportedPos = s0;
                                    s1 = peg$c38(s1, s3);
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

                    function peg$parsecoordinate() {
                        var s0, s1;

                        s0 = peg$currPos;
                        s1 = peg$parsenumber();
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c39(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parsenonnegative_number() {
                        var s0;

                        s0 = peg$parsefloating_point_constant();
                        if (s0 === peg$FAILED) {
                            s0 = peg$parsedigit_sequence();
                        }

                        return s0;
                    }

                    function peg$parsenumber() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = peg$parsesign();
                        if (s1 === peg$FAILED) {
                            s1 = peg$c2;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsefloating_point_constant();
                            if (s2 !== peg$FAILED) {
                                s1 = [s1, s2];
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
                            s1 = peg$parsesign();
                            if (s1 === peg$FAILED) {
                                s1 = peg$c2;
                            }
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parsedigit_sequence();
                                if (s2 !== peg$FAILED) {
                                    s1 = [s1, s2];
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

                    function peg$parseflag() {
                        var s0;

                        if (input.charCodeAt(peg$currPos) === 48) {
                            s0 = peg$c40;
                            peg$currPos++;
                        } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c41);
                            }
                        }
                        if (s0 === peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 49) {
                                s0 = peg$c42;
                                peg$currPos++;
                            } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c43);
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsecomma_wsp() {
                        var s0, s1, s2, s3, s4;

                        s0 = peg$currPos;
                        s1 = [];
                        s2 = peg$parsewsp();
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                s2 = peg$parsewsp();
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsecomma();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = [];
                                s4 = peg$parsewsp();
                                while (s4 !== peg$FAILED) {
                                    s3.push(s4);
                                    s4 = peg$parsewsp();
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
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$parsecomma();
                            if (s1 !== peg$FAILED) {
                                s2 = [];
                                s3 = peg$parsewsp();
                                while (s3 !== peg$FAILED) {
                                    s2.push(s3);
                                    s3 = peg$parsewsp();
                                }
                                if (s2 !== peg$FAILED) {
                                    s1 = [s1, s2];
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

                    function peg$parsecomma() {
                        var s0;

                        if (input.charCodeAt(peg$currPos) === 44) {
                            s0 = peg$c44;
                            peg$currPos++;
                        } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c45);
                            }
                        }

                        return s0;
                    }

                    function peg$parsefloating_point_constant() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = peg$parsefractional_constant();
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parseexponent();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s1 = [s1, s2];
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
                            s1 = peg$parsedigit_sequence();
                            if (s1 !== peg$FAILED) {
                                s2 = peg$parseexponent();
                                if (s2 !== peg$FAILED) {
                                    s1 = [s1, s2];
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

                    function peg$parsefractional_constant() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        s1 = peg$parsedigit_sequence();
                        if (s1 === peg$FAILED) {
                            s1 = peg$c2;
                        }
                        if (s1 !== peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 46) {
                                s2 = peg$c46;
                                peg$currPos++;
                            } else {
                                s2 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c47);
                                }
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsedigit_sequence();
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
                        if (s0 === peg$FAILED) {
                            s0 = peg$currPos;
                            s1 = peg$parsedigit_sequence();
                            if (s1 !== peg$FAILED) {
                                if (input.charCodeAt(peg$currPos) === 46) {
                                    s2 = peg$c46;
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c47);
                                    }
                                }
                                if (s2 !== peg$FAILED) {
                                    s1 = [s1, s2];
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

                    function peg$parseexponent() {
                        var s0, s1, s2, s3;

                        s0 = peg$currPos;
                        if (peg$c48.test(input.charAt(peg$currPos))) {
                            s1 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c49);
                            }
                        }
                        if (s1 !== peg$FAILED) {
                            s2 = peg$parsesign();
                            if (s2 === peg$FAILED) {
                                s2 = peg$c2;
                            }
                            if (s2 !== peg$FAILED) {
                                s3 = peg$parsedigit_sequence();
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

                    function peg$parsesign() {
                        var s0;

                        if (input.charCodeAt(peg$currPos) === 43) {
                            s0 = peg$c50;
                            peg$currPos++;
                        } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c51);
                            }
                        }
                        if (s0 === peg$FAILED) {
                            if (input.charCodeAt(peg$currPos) === 45) {
                                s0 = peg$c52;
                                peg$currPos++;
                            } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) {
                                    peg$fail(peg$c53);
                                }
                            }
                        }

                        return s0;
                    }

                    function peg$parsedigit_sequence() {
                        var s0, s1, s2;

                        s0 = peg$currPos;
                        s1 = [];
                        if (peg$c54.test(input.charAt(peg$currPos))) {
                            s2 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s2 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c55);
                            }
                        }
                        if (s2 !== peg$FAILED) {
                            while (s2 !== peg$FAILED) {
                                s1.push(s2);
                                if (peg$c54.test(input.charAt(peg$currPos))) {
                                    s2 = input.charAt(peg$currPos);
                                    peg$currPos++;
                                } else {
                                    s2 = peg$FAILED;
                                    if (peg$silentFails === 0) {
                                        peg$fail(peg$c55);
                                    }
                                }
                            }
                        } else {
                            s1 = peg$c0;
                        }
                        if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c56(s1);
                        }
                        s0 = s1;

                        return s0;
                    }

                    function peg$parsewsp() {
                        var s0;

                        if (peg$c57.test(input.charAt(peg$currPos))) {
                            s0 = input.charAt(peg$currPos);
                            peg$currPos++;
                        } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) {
                                peg$fail(peg$c58);
                            }
                        }

                        return s0;
                    }


                    // The last coordinate we are at in the path. In absolute coords.
                    var lastCoord = [0, 0];
                    // The last control point we encountered in the path. In absolute coords.
                    var lastControl = [0, 0];
                    // The list of operations we've parsed so far.
                    var ops = [];
                    // Have we parsed the first sub-path yet?
                    var firstSubPath = true;
                    // The letter of the last parsed command.
                    var lastCh = '';

                    // Flatten an array.
                    function flatten(a) {
                        var flat = [];
                        for (var i = 0; i < a.length; i++) {
                            if (a[i] instanceof Array) {
                                flat.push.apply(flat, flatten(a[i]));
                            } else {
                                flat.push(a[i]);
                            }
                        }
                        return flat;
                    }

                    // Convert a position into an absolute position.
                    function makeAbsolute(c, coord) {
                        if ('mlazhvcsqt'.indexOf(c) === -1) {
                            lastCoord = coord;
                        } else {
                            lastCoord[0] += coord[0];
                            lastCoord[1] += coord[1];
                        }
                        lastCh = c;
                        return lastCoord.slice(0);
                    }

                    // Convert a sequence of coordinates into absolute coordinates.
                    //
                    // For arguments that take multiple coord pairs, such as bezier.
                    function makeAbsoluteMultiple(c, seq) {
                        var r = [];
                        var lastPosCopy = lastCoord.slice(0);
                        for (var i = 0; i < seq.length; i += 2) {
                            // Only the last point should update lastCoord.
                            lastCoord = lastPosCopy.slice(0);
                            var coord = makeAbsolute(c, seq.slice(i, i + 2));
                            r = r.concat(coord);
                            // Record the last control point, it might be needed for
                            // shorthand operations.
                            if (i == seq.length - 4) {
                                lastControl = coord.slice(0);
                            }
                        }
                        return r;
                    }

                    // Find the reflection of the last control point over
                    // the last postion in the path.
                    function makeReflected() {
                        if ('CcSsQqTt'.indexOf(lastCh) == -1) {
                            lastControl = lastCoord.slice(0);
                        }
                        // reflected = 2*lastCoord - lastControl
                        // Note the result is absolute, not relative.
                        var r = [0, 0];
                        r[0] = 2 * lastCoord[0] - lastControl[0];
                        r[1] = 2 * lastCoord[1] - lastControl[1];
                        return r;
                    }

                    function makeAbsoluteFromX(c, x) {
                        var coord = [x, 0];
                        if (c == 'H') {
                            coord[1] = lastCoord[1];
                        }
                        return makeAbsolute(c, coord);
                    }

                    function makeAbsoluteFromY(c, y) {
                        var coord = [0, y];
                        if (c == 'V') {
                            coord[0] = lastCoord[0];
                        }
                        return makeAbsolute(c, coord);
                    }

                    function concatSequence(one, rest) {
                        var r = [one];
                        if (rest && rest.length > 1) {
                            var rem = rest[1];
                            for (var i = 0; i < rem.length; i++) {
                                r.push(rem[i]);
                            }
                        }
                        return r;
                    }

                    function mag(v) {
                        return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
                    }

                    function dot(u, v) {
                        return (u[0] * v[0] + u[1] * v[1]);
                    }

                    function ratio(u, v) {
                        return dot(u, v) / (mag(u) * mag(v))
                    }

                    function clamp(value, min, max) {
                        return Math.min(Math.max(val, min), max);
                    }

                    function angle(u, v) {
                        var sign = 1.0;
                        if ((u[0] * v[1] - u[1] * v[0]) < 0) {
                            sign = -1.0;
                        }
                        return sign * Math.acos(clamp(ratio(u, v)), -1, 1);
                    }

                    function rotClockwise(v, angle) {
                        var cost = Math.cos(angle);
                        var sint = Math.sin(angle);
                        return [cost * v[0] + sint * v[1], -1 * sint * v[0] + cost * v[1]];
                    }

                    function rotCounterClockwise(v, angle) {
                        var cost = Math.cos(angle);
                        var sint = Math.sin(angle);
                        return [cost * v[0] - sint * v[1], sint * v[0] + cost * v[1]];
                    }

                    function midPoint(u, v) {
                        return [(u[0] - v[0]) / 2.0, (u[1] - v[1]) / 2.0];
                    }

                    function meanVec(u, v) {
                        return [(u[0] + v[0]) / 2.0, (u[1] + v[1]) / 2.0];
                    }

                    function pointMul(u, v) {
                        return [u[0] * v[0], u[1] * v[1]];
                    }

                    function scale(c, v) {
                        return [c * v[0], c * v[1]];
                    }

                    function sum(u, v) {
                        return [u[0] + v[0], u[1] + v[1]];
                    }

                    // Convert an SVG elliptical arc to a series of canvas commands.
                    //
                    // x1, x2: start and stop coordinates of the ellipse.
                    // rx, ry: radii of the ellipse.
                    // phi: rotation of the ellipse.
                    // fA: large arc flag.
                    // fS: sweep flag.
                    function ellipseFromEllipticalArc(x1, rx, ry, phi, fA, fS, x2) {
                        // Convert from endpoint to center parametrization, as detailed in:
                        //   http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
                        if (rx == 0 || ry == 0) {
                            ops.push({ type: 'lineTo', args: x2 });
                            return;
                        }
                        var phi = phi * (Math.PI / 180.0);
                        rx = Math.abs(rx);
                        ry = Math.abs(ry);
                        var xPrime = rotClockwise(midPoint(x1, x2), phi);                // F.6.5.1
                        var xPrime2 = pointMul(xPrime, xPrime);
                        var rx2 = Math.pow(rx, 2);
                        var ry2 = Math.pow(ry, 2);

                        var lambda = Math.sqrt(xPrime2[0] / rx2 + xPrime2[1] / ry2);
                        if (lambda > 1) {
                            rx *= lambda;
                            ry *= lambda;
                            rx2 = Math.pow(rx, 2);
                            ry2 = Math.pow(ry, 2);
                        }
                        var factor = Math.sqrt(Math.abs(rx2 * ry2 - rx2 * xPrime2[1] - ry2 * xPrime2[0]) /
                            (rx2 * xPrime2[1] + ry2 * xPrime2[0]));
                        if (fA == fS) {
                            factor *= -1.0;
                        }
                        var cPrime = scale(factor, [rx * xPrime[1] / ry, -ry * xPrime[0] / rx]); // F.6.5.2
                        var c = sum(rotCounterClockwise(cPrime, phi), meanVec(x1, x2));  // F.6.5.3
                        var x1UnitVector = [(xPrime[0] - cPrime[0]) / rx, (xPrime[1] - cPrime[1]) / ry];
                        var x2UnitVector = [(-1.0 * xPrime[0] - cPrime[0]) / rx, (-1.0 * xPrime[1] - cPrime[1]) / ry];
                        var theta = angle([1, 0], x1UnitVector);                         // F.6.5.5
                        var deltaTheta = angle(x1UnitVector, x2UnitVector);              // F.6.5.6
                        var start = theta;
                        var end = theta + deltaTheta;
                        ops.push(
                            { type: 'save', args: [] },
                            { type: 'translate', args: [c[0], c[1]] },
                            { type: 'rotate', args: [phi] },
                            { type: 'scale', args: [rx, ry] },
                            { type: 'arc', args: [0, 0, 1, start, end, 1 - fS] },
                            { type: 'restore', args: [] }
                        );
                    }


                    peg$result = peg$startRuleFunction();

                    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
                        return peg$result;
                    } else {
                        if (peg$result !== peg$FAILED && peg$currPos < input.length) {
                            peg$fail({ type: "end", description: "end of input" });
                        }

                        throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
                    }
                }

                return {
                    SyntaxError: SyntaxError,
                    parse: parse
                };
            })();

            function Path_(arg) {
                this.ops_ = [];
                if (arg == undefined) {
                    return;
                }
                if (typeof arg == 'string') {
                    try {
                        this.ops_ = parser.parse(arg);
                    } catch (e) {
                        // Treat an invalid SVG path as an empty path.
                    }
                } else if (arg.hasOwnProperty('ops_')) {
                    this.ops_ = arg.ops_.slice(0);
                } else {
                    throw 'Error: ' + typeof arg + 'is not a valid argument to Path';
                }
            }

            // TODO(jcgregorio) test for arcTo and implement via something.


            // Path methods that map simply to the CanvasRenderingContext2D.
            var simple_mapping = [
                'closePath',
                'moveTo',
                'lineTo',
                'quadraticCurveTo',
                'bezierCurveTo',
                'rect',
                'arc',
                'arcTo',
                'ellipse',
                'isPointInPath',
                'isPointInStroke',
            ];

            function createFunction(name) {
                return function () {
                    this.ops_.push({ type: name, args: Array.prototype.slice.call(arguments, 0) });
                };
            }

            // Add simple_mapping methods to Path2D.
            for (var i = 0; i < simple_mapping.length; i++) {
                var name = simple_mapping[i];
                Path_.prototype[name] = createFunction(name);
            }

            Path_.prototype['addPath'] = function (path, tr) {
                var hasTx = false;
                if (tr
                    && tr.a != undefined
                    && tr.b != undefined
                    && tr.c != undefined
                    && tr.d != undefined
                    && tr.e != undefined
                    && tr.f != undefined) {
                    hasTx = true;
                    this.ops_.push({ type: 'save', args: [] });
                    this.ops_.push({ type: 'transform', args: [tr.a, tr.b, tr.c, tr.d, tr.e, tr.f] });
                }
                this.ops_ = this.ops_.concat(path.ops_);
                if (hasTx) {
                    this.ops_.push({ type: 'restore', args: [] });
                }
            }

            original_fill = CanvasRenderingContext2D.prototype.fill;
            original_stroke = CanvasRenderingContext2D.prototype.stroke;
            original_clip = CanvasRenderingContext2D.prototype.clip;
            original_is_point_in_path = CanvasRenderingContext2D.prototype.isPointInPath;
            original_is_point_in_stroke = CanvasRenderingContext2D.prototype.isPointInStroke;

            // Replace methods on CanvasRenderingContext2D with ones that understand Path2D.
            CanvasRenderingContext2D.prototype.fill = function (arg) {
                if (arg instanceof Path_) {
                    this.beginPath();
                    for (var i = 0, len = arg.ops_.length; i < len; i++) {
                        var op = arg.ops_[i];
                        CanvasRenderingContext2D.prototype[op.type].apply(this, op.args);
                    }
                    original_fill.apply(this, Array.prototype.slice.call(arguments, 1));
                } else {
                    original_fill.apply(this, arguments);
                }
            }

            CanvasRenderingContext2D.prototype.stroke = function (arg) {
                if (arg instanceof Path_) {
                    this.beginPath();
                    for (var i = 0, len = arg.ops_.length; i < len; i++) {
                        var op = arg.ops_[i];
                        CanvasRenderingContext2D.prototype[op.type].apply(this, op.args);
                    }
                    original_stroke.call(this);
                } else {
                    original_stroke.call(this);
                }
            }

            CanvasRenderingContext2D.prototype.clip = function (arg) {
                if (arg instanceof Path_) {
                    // Note that we don't save and restore the context state, since the
                    // clip region is part of the state. Not really a problem since the
                    // HTML 5 spec doesn't say that clip(path) doesn't affect the current
                    // path.
                    this.beginPath();
                    for (var i = 0, len = arg.ops_.length; i < len; i++) {
                        var op = arg.ops_[i];
                        CanvasRenderingContext2D.prototype[op.type].apply(this, op.args);
                    }
                    original_clip.apply(this, Array.prototype.slice.call(arguments, 1));
                } else {
                    original_clip.apply(this, arguments);
                }
            }

            CanvasRenderingContext2D.prototype.isPointInPath = function (arg) {
                if (arg instanceof Path_) {
                    this.beginPath();
                    for (var i = 0, len = arg.ops_.length; i < len; i++) {
                        var op = arg.ops_[i];
                        CanvasRenderingContext2D.prototype[op.type].apply(this, op.args);
                    }
                    return original_is_point_in_path.apply(this, Array.prototype.slice.call(arguments, 1));
                } else {
                    return original_is_point_in_path.apply(this, arguments);
                }
            }
            CanvasRenderingContext2D.prototype.isPointInStroke = function (arg) {
                if (arg instanceof Path_) {
                    this.beginPath();
                    for (var i = 0, len = arg.ops_.length; i < len; i++) {
                        var op = arg.ops_[i];
                        CanvasRenderingContext2D.prototype[op.type].apply(this, op.args);
                    }
                    return original_is_point_in_stroke.apply(this, Array.prototype.slice.call(arguments, 1));
                } else {
                    return original_is_point_in_stroke.apply(this, arguments);
                }
            }

            // Set up externs.
            Path2D = Path_;
        })();
    }

})(
    typeof CanvasRenderingContext2D === "undefined" ? undefined : CanvasRenderingContext2D,
    typeof require === "undefined" ? undefined : require
);
//Canvas Polyfill Ends

//Canvas2Blob external

/*
 * JavaScript Canvas to Blob
 * https://github.com/blueimp/JavaScript-Canvas-to-Blob
 *
 * Copyright 2012, Sebastian Tschan
 * https://blueimp.net
 *
 * Licensed under the MIT license:
 * https://opensource.org/licenses/MIT
 *
 * Based on stackoverflow user Stoive's code snippet:
 * http://stackoverflow.com/q/4998908
 */

/* global define, Uint8Array, ArrayBuffer, module */
; (function (window) {
    'use strict'

    var CanvasPrototype =
        window.HTMLCanvasElement && window.HTMLCanvasElement.prototype
    var hasBlobConstructor =
        window.Blob &&
        (function () {
            try {
                return Boolean(new Blob())
            } catch (e) {
                return false
            }
        })()
    var hasArrayBufferViewSupport =
        hasBlobConstructor &&
        window.Uint8Array &&
        (function () {
            try {
                return new Blob([new Uint8Array(100)]).size === 100
            } catch (e) {
                return false
            }
        })()
    var BlobBuilder =
        window.BlobBuilder ||
        window.WebKitBlobBuilder ||
        window.MozBlobBuilder ||
        window.MSBlobBuilder
    var dataURIPattern = /^data:((.*?)(;charset=.*?)?)(;base64)?,/
    var dataURLtoBlob =
        (hasBlobConstructor || BlobBuilder) &&
        window.atob &&
        window.ArrayBuffer &&
        window.Uint8Array &&
        function (dataURI) {
            var matches,
                mediaType,
                isBase64,
                dataString,
                byteString,
                arrayBuffer,
                intArray,
                i,
                bb
            // Parse the dataURI components as per RFC 2397
            matches = dataURI.match(dataURIPattern)
            if (!matches) {
                throw new Error('invalid data URI')
            }
            // Default to text/plain;charset=US-ASCII
            mediaType = matches[2]
                ? matches[1]
                : 'text/plain' + (matches[3] || ';charset=US-ASCII')
            isBase64 = !!matches[4]
            dataString = dataURI.slice(matches[0].length)
            if (isBase64) {
                // Convert base64 to raw binary data held in a string:
                byteString = atob(dataString)
            } else {
                // Convert base64/URLEncoded data component to raw binary:
                byteString = decodeURIComponent(dataString)
            }
            // Write the bytes of the string to an ArrayBuffer:
            arrayBuffer = new ArrayBuffer(byteString.length)
            intArray = new Uint8Array(arrayBuffer)
            for (i = 0; i < byteString.length; i += 1) {
                intArray[i] = byteString.charCodeAt(i)
            }
            // Write the ArrayBuffer (or ArrayBufferView) to a blob:
            if (hasBlobConstructor) {
                return new Blob([hasArrayBufferViewSupport ? intArray : arrayBuffer], {
                    type: mediaType
                });
            }
            bb = new BlobBuilder();
            bb.append(arrayBuffer);
            return bb.getBlob(mediaType);
        };
    if (window.HTMLCanvasElement && !CanvasPrototype.toBlob) {
        if (CanvasPrototype.mozGetAsFile) {
            CanvasPrototype.toBlob = function (callback, type, quality) {
                var self = this;
                setTimeout(function () {
                    if (quality && CanvasPrototype.toDataURL && dataURLtoBlob) {
                        callback(dataURLtoBlob(self.toDataURL(type, quality)));
                    } else {
                        callback(self.mozGetAsFile('blob', type));
                    }
                });
            };
        } else if (CanvasPrototype.toDataURL && dataURLtoBlob) {
            if (CanvasPrototype.msToBlob) {
                CanvasPrototype.toBlob = function (callback, type, quality) {
                    var self = this;
                    setTimeout(function () {
                        if (
                            ((type && type !== 'image/png') || quality) &&
                            CanvasPrototype.toDataURL &&
                            dataURLtoBlob
                        ) {
                            callback(dataURLtoBlob(self.toDataURL(type, quality)));
                        } else {
                            callback(self.msToBlob(type));
                        }
                    });
                };
            } else {
                CanvasPrototype.toBlob = function (callback, type, quality) {
                    var self = this;
                    setTimeout(function () {
                        callback(dataURLtoBlob(self.toDataURL(type, quality)));
                    });
                };
            }
        }
    }
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return dataURLtoBlob;
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = dataURLtoBlob;
    } else {
        window.dataURLtoBlob = dataURLtoBlob;
    }
})(window);
//Canvas to blob ends

// Custom Graphics

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

//Graphics utilities

function Point(x, y) {
    this.x = x;
    this.y = y;
}

Point.prototype.move = function (x, y) {
    this.x = x;
    this.y = y;
};

Point.prototype.translate = function (dx, dy) {
    this.x += dx;
    this.y += dy;
};


/**
 * *
 *
 * @param {Point} pt the Point object whose distance to this Point object is
 * required
 * @return the distance between the 2 Point objects.
 */
Point.prototype.calcDistanceTo = function (pt) {
    if (pt && pt.constructor.name === 'Point') {
        return Math.sqrt(Math.pow((this.x - pt.x), 2) + Math.pow((this.y - pt.y), 2));
    }
    return Number.NaN;
};


Point.prototype.equals = function (point) {
    if (point && point.constructor.name === 'Point') {
        return point.x === this.x && point.y === this.y;
    }
    return false;
};

function FloatPoint(x, y, z) {
    Point.call(this, x, y);
    this.z = z;
}


FloatPoint.prototype.constructor = FloatPoint;
FloatPoint.prototype = Object.create(Point.prototype);

FloatPoint.prototype.move = function (x, y, z) {
    Object.getPrototypeOf(FloatPoint.prototype).move.call(this, x, y);
    this.z = z;
};

FloatPoint.prototype.translate = function (dx, dy, dz) {
    Object.getPrototypeOf(FloatPoint.prototype).translate.call(this, dx, dy);
    this.z += dz;
};

/**
 * *
 *
 * @param {FloatPoint} fpt the FloatPoint object whose distance to this Point object is
 * required
 * @return the distance between the 2 FloatPoint objects.
 */
FloatPoint.prototype.calcDistanceTo = function (fpt) {
    if (fpt && fpt.constructor.name === 'FloatPoint') {
        return Math.sqrt(pow((this.x - fpt.x), 2) + Math.pow((this.y - fpt.y), 2) + Math.pow((this.z - fpt.z), 2));
    }
    return Number.NaN;
};


FloatPoint.prototype.toPoint = function () {
    return new Point(this.x, this.y);
};

FloatPoint.prototype.equals = function (fpt) {
    if (fpt && fpt.constructor.name === 'FloatPoint') {
        return fpt.x === this.x && fpt.y === this.y && fpt.z === this.z;
    }
    return false;
};


/**
 *
 * @param {FloatPoint} pt the point between which an imaginary line runs
 * @return the gradient of the projection of the line joining these points
 * on the XY plane
 */
FloatPoint.prototype.findXYGrad = function (pt) {
    if (pt && pt.constructor.name === 'FloatPoint') {
        return (this.y - pt.y) / (this.x - pt.x);
    }
    return Number.NaN;
};

/**
 *
 * @param {FloatPoint} pt the point between which an imaginary line runs
 * @return the gradient of the projection of the line joining these points
 * on the XZ plane
 */
FloatPoint.prototype.findXZGrad = function (pt) {
    if (pt && pt.constructor.name === 'FloatPoint') {
        return (this.z - pt.z) / (this.x - pt.x);
    }
    return Number.NaN;
};

/**
 *
 * @param {FloatPoint} pt the point between which an imaginary line runs
 * @return the gradient of the projection of the line joining these points
 * on the YZ plane
 */
FloatPoint.prototype.findYZGrad = function (pt) {
    if (pt && pt.constructor.name === 'FloatPoint') {
        return (this.z - pt.z) / (this.y - pt.y);
    }
    return Number.NaN;
};

/**
 *
 * @param {Point} p1 The first Point object.
 * @param {Point} p2 The second Point object.
 * @return The Point object that contains the coordinates of the midpoint of
 * the line joining p1 and p2
 */
function midPoint(p1, p2) {
    if (p1 && p1.constructor.name === 'Point' && p2 && p2.constructor.name === 'Point') {
        return new Point((0.5 * (p1.x + p2.x)), (0.5 * (p1.y + p2.y)));
    }
    return null;
}
;

/**
 *
 * @param {FloatPoint} p1 The first FloatPoint object.
 * @param {FloatPoint} p2 The second FloatPoint object.
 * @return The FloatPoint object that contains the coordinates of the midpoint of
 * the line joining p1 and p2
 */
function midPointF(p1, p2) {
    if (p1 && p1.constructor.name === 'FloatPoint' && p2 && p2.constructor.name === 'FloatPoint') {
        return new FloatPoint((0.5 * (p1.x + p2.x)), (0.5 * (p1.y + p2.y)), (0.5 * (p1.z + p2.z)));
    }
    return null;
}
;


/**
 *
 * @param {FloatPoint} p1 The first point
 * @param {FloatPoint} p2 The second point
 * @return true if this Point object lies on the same straight line with p1
 * and p2 and it lies in between them.
 */
FloatPoint.prototype.liesBetween = function (p1, p2) {
    if (p1 && p1.constructor.name === 'FloatPoint' && p2 && p2.constructor.name === 'FloatPoint') {
        var truly1 = ((p1.x <= x && p2.x >= this.x) || (p2.x <= x && p1.x >= this.x));
        var truly2 = ((p1.y <= y && p2.y >= this.y) || (p2.y <= y && p1.y >= this.y));
        var truly3 = ((p1.z <= z && p2.z >= this.z) || (p2.z <= z && p1.z >= this.z));

        return truly1 && truly2 && truly3 && isCollinearWith(p1, p2);
    }
    return false;
};


/**
 * A line passing between 2 points
 * @param {FloatPoint} fpt1
 * @param {FloatPoint} fpt2
 * @returns {Line}
 */
function Line(fpt1, fpt2) {
    if (fpt1 && fpt1.constructor.name === 'FloatPoint' && fpt2 && fpt2.constructor.name === 'FloatPoint') {
        this.m = fpt1.findXYGrad(fpt2);
        this.c = fpt1.y - this.m * fpt1.x;
    }
    return null;
}


/**
 *
 * @param {Number} y the y coordinate of
 * a given point on a Line object.
 * @return the x coordinate of that point.
 */
Line.prototype.getX = function (y) {
    if (typeof y === "number") {
        return (y - this.c) / this.m;
    }
    return Number.NaN;
};

Line.prototype.getY = function (x) {
    if (typeof x === "number") {
        return (this.m * x) + this.c;
    }
    return Number.NaN;
};


/**
 *
 * Finds the distance between 2 Point objects lying on this Line object
 * They must lie on this Line object, else the method will return 0;
 * @param {Point} p1 the first Point object to consider
 * @param {Point} p2 the second Point object to consider
 * @return the distance along this Line
 * object between the 2 given Point objects lying on it
 */

Line.prototype.distance = function (p1, p2) {
    if (p1 && p1.constructor.name === 'Point' && p2 && p2.constructor.name === 'Point') {
        if (this.passesThroughPoint(p1) && this.passesThroughPoint(p2)) {
            return p2.calcDistanceTo(p1);
        }
    }
    return Number.NaN;
};

/**
 *
 * Finds the distance between 2 Point objects lying on this Line object
 * They must lie on this Line object, else the method will return 0;
 * @param {FloatPoint} p1 the first FloatPoint object to consider
 * @param {FloatPoint} p2 the second FloatPoint object to consider
 * @return the distance along this Line
 * object between the 2 given Point objects lying on it
 */
Line.prototype.distanceF = function (p1, p2) {
    if (p1 && p1.constructor.name === 'FloatPoint' && p2 && p2.constructor.name === 'FloatPoint') {
        if (this.passesThroughPoint(p1) && this.passesThroughPoint(p2)) {
            return p2.calcDistanceTo(p1);
        }
    }
    return Number.NaN;
};

/**
 *
 * Finds the square of the distance between 2 Point objects lying on this Line object
 * They must lie on this Line object, else the method will return 0;
 * @param {FloatPoint} p1 the first Point object to consider
 * @param {FloatPoint} p2 the second Point object to consider
 * @return the distance along this Line
 * object between the 2 given Point objects lying on it
 */
Line.prototype.distanceSquared = function (p1, p2) {
    if (p1 && p1.constructor.name === 'FloatPoint' && p2 && p2.constructor.name === 'FloatPoint') {
        if (this.passesThroughPoint(p1) && this.passesThroughPoint(p2)) {
            var dist = p2.calcDistanceTo(p1);
            return dist * dist;
        }
    }
    return Number.NaN;
};


/**
 *
 * @param {Line} line the Line object to be checked if or not it intersects with this one.
 * @return true if the 2 Line objects intersect.
 */
Line.prototype.intersectsLine = function (line) {
    return !this.isParallelTo(line);
};

/**
 * Checks if this Line object is parallel to another.
 * @param {Line} line the Line object to be checked against this one for parallelism
 * @return true if it is parallel to the other Line object
 */
Line.prototype.isParallelTo = function (line) {
    return approxEquals(this.m, line.m);
};

/**
 *
 * @param {Point} p1 the Point object that we
 * wish to check if or not it lies on this Line
 * object.
 * @return true if it lies on this Line object
 */
Line.prototype.passesThroughPoint = function (p1) {
    if (p1 && p1.constructor.name === 'Point') {
        return approxEquals(p1.y, (this.m * p1.x + this.c));
    }
    return false;
};
/**
 *
 * @param {FloatPoint} p1 the Point object that we
 * wish to check if or not it lies on this Line
 * object.
 * @return true if it lies on this Line object
 */
Line.prototype.passesThroughPointF = function (p1) {
    if (p1 && p1.constructor.name === 'FloatPoint') {
        return approxEquals(p1.y, (this.m * p1.x + this.c));
    }
};

/**
 *
 * @param {Line} line the Line object whose point of
 * intersection with this Line object is required
 * @return the point of intersection of both Line objects
 */
Line.prototype.intersectionWithLine = function (line) {
    if (line && line.constructor.name === 'Line') {
        var x = (-1 * (this.c - line.c) / (this.m - line.m));
        var y = this.m * x + this.c;
        return new FloatPoint(x, y);
    }
    return null;
};

/**
 * Compares two numbers to see if they are close enough to be almost the same
 * It checks if the values deviate by 1.0E-14 or lesser.
 * @param {Number} val1 the first value to compare
 * @param {Number} val2 the second value to compare
 * @param minDeviation the minimum difference they
 * must have to be acceptably equal.
 * @return true if the values deviate by 1.0E-14 or lesser.
 */
function approxEquals(val1, val2, minDeviation) {
    if (!minDeviation) {
        minDeviation = 1.0E-14;
    }

    if (typeof val1 === "number" && typeof val2 === "number" && typeof minDeviation === "number") {
        return Math.abs(Math.abs(val1) - Math.abs(val2)) <= Math.abs(minDeviation);
    }
    return false;

}

/**
 *
 * @param {string} id
 * @param {Number} x1 The starting x on the line
 * @param {Number} x2 The ending x on the line
 * @param {string} color The color of the line in color hex format: e.g. #000FFF
 * @param {Number} thickness The stroke thickness for the line.
 * @returns {undefined}
 */
Line.prototype.draw = function (id, x1, x2, color, thickness) {
    if (typeof id === "string" && typeof x1 === "number" && typeof x2 === "number" && typeof color === "string" && typeof thickness === "number") {
        var canvas = document.getElementById(id);

        var ctx = canvas.getContext("2d");

        var wid = canvas.width;
        var hei = canvas.height;

        let y1 = this.getY(x1);
        let y2 = this.getY(x2);

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    } else {
        logger("Invalid Line draw args");
    }


};

function Dimension(width, height) {
    if (typeof width === "number" && typeof height === "number") {
        this.width = width;
        this.height = height;
    } else {
        this.width = 0;
        this.height = 0;
    }

}

/**
 * Scales a given Dimension along both the width and the height.
 * @param {Number} scaleFactor
 * @returns {undefined}
 */
Dimension.prototype.scale = function (scaleFactor) {
    if (typeof scaleFactor === "number") {
        this.width *= scaleFactor;
        this.height *= scaleFactor;
    }
};

/**
 * Scales a given Dimension along both the width and the height and returns the nw dimension
 * @param {Number} scaleFactor
 * @returns a new Dimension
 */
Dimension.prototype.getScaledInstance = function (scaleFactor) {
    if (typeof scaleFactor === "number") {
        var w = this.width * scaleFactor;
        var h = this.height * scaleFactor;
        return new Dimension(w, h);
    }
    return null;
};

/**
 *
 * @param {Number} a the coefficient in x squared
 * @param {Number} b the coefficient in x
 * @param {Number} c the constant factor
 * @returns {Quadratic}
 */
function Quadratic(a, b, c) {
    if (typeof a === "number" && typeof b === "number" && typeof c === "number") {
        this.a = a;
        this.b = b;
        this.c = c;
    }
}

Quadratic.prototype.solve = function () {
    var result = "";

    var a = this.a;
    var b = this.b;
    var c = this.c;


    if ((Math.pow(b, 2) - 4 * a * c) >= 0) {
        var x1 = ((-b / (2 * a)) + (Math.sqrt(Math.pow(b, 2) - 4 * a * c) / (2 * a)));
        var x2 = ((-b / (2 * a)) - (Math.sqrt(Math.pow(b, 2) - 4 * a * c) / (2 * a)));

        return x1 + " , " + x2;
    } else if ((pow(b, 2) - 4 * a * c) < 0) {
        var a1 = (-b / (2 * a));
        var b1 = ((Math.sqrt(4 * a * c - Math.pow(b, 2)) / (2 * a)));

        var a2 = (-b / (2 * a));
        var b2 = ((Math.sqrt(4 * a * c - Math.pow(b, 2)) / (2 * a)));

        return a1 + " + " + b1 + " i , " + a2 + " - " + b2 + " i";
    }
    //2p^2-3p-4.09=0
};

Quadratic.prototype.solutionArray = function () {

    var a = this.a;
    var b = this.b;
    var c = this.c;

    var arr = [];


    if ((Math.pow(b, 2) - 4 * a * c) >= 0) {
        var x1 = ((-b / (2 * a)) + (Math.sqrt(Math.pow(b, 2) - 4 * a * c) / (2 * a)));
        var x2 = ((-b / (2 * a)) - (Math.sqrt(Math.pow(b, 2) - 4 * a * c) / (2 * a)));
        arr.push(x1);
        arr.push(x2);
    } else if ((pow(b, 2) - 4 * a * c) < 0) {
        var a1 = (-b / (2 * a));
        var b1 = ((Math.sqrt(4 * a * c - Math.pow(b, 2)) / (2 * a)));

        var a2 = (-b / (2 * a));
        var b2 = ((Math.sqrt(4 * a * c - Math.pow(b, 2)) / (2 * a)));

        arr.push(a1 + " + " + b1 + " i");
        arr.push(a2 + " - " + b2 + " i");


    }

    return arr;
};

/**
 *
 * @param {type} left The x coordinate of the left side of the rectangle
 * @param {type} top The y coordinate of the upper side of the rectangle
 * @param {type} right The x coordinate of the right side of the rectangle
 * @param {type} bottom The y coordinate of the lower side of the rectangle
 * @returns {Rectangle}
 */
function Rectangle(left, top, right, bottom) {
    this.width = this.height = this.left = this.top = 0;
    if (typeof left === 'number' && typeof top === 'number' && typeof right === 'number' && typeof bottom === 'number') {
        this.left = left;
        this.top = top;
        this.width = right - left;
        this.height = bottom - top;
    }

}

Rectangle.prototype.right = function () {
    return this.left + this.width;
};

Rectangle.prototype.bottom = function () {
    return this.top + this.height;
};

Rectangle.prototype.centerX = function () {
    return this.left + this.width / 2;
};

Rectangle.prototype.centerY = function () {
    return this.top + this.height / 2;
};

Rectangle.prototype.setLocation = function (x, y) {
    if (typeof x === 'number' && typeof y === 'number') {
        this.left = x;
        this.top = y;
    }
};

Rectangle.prototype.getLocation = function () {
    return new Point(this.left, this.top);
};

/**
 * The algorithm here is a translation of what is in the Java API.
 * @param {Number} dx
 * @param {Number} dy
 * @returns {undefined}]
 */
Rectangle.prototype.translate = function (dx, dy) {
    var oldv = this.left;
    var newv = oldv + dx;
    if (dx < 0) {
        // moving leftward
        if (newv > oldv) {
            // negative overflow
            // Only adjust width if it was valid (>= 0).
            if (this.width >= 0) {
                // The right edge is now conceptually at
                // newv+width, but we may move newv to prevent
                // overflow.  But we want the right edge to
                // remain at its new location in spite of the
                // clipping.  Think of the following adjustment
                // conceptually the same as:
                // width += newv; newv = MIN_VALUE; width -= newv;
                this.width += newv - Number.MIN_VALUE;
                // width may go negative if the right edge went past
                // MIN_VALUE, but it cannot overflow since it cannot
                // have moved more than MIN_VALUE and any non-negative
                // number + MIN_VALUE does not overflow.
            }
            newv = Number.MIN_VALUE;
        }
    } else {
        // moving rightward (or staying still)
        if (newv < oldv) {
            // positive overflow
            if (this.width >= 0) {
                // Conceptually the same as:
                // width += newv; newv = MAX_VALUE; width -= newv;
                this.width += newv - Number.MAX_VALUE;
                // With large widths and large displacements
                // we may overflow so we need to check it.
                if (this.width < 0)
                    this.width = Number.MAX_VALUE;
            }
            newv = Number.MAX_VALUE;
        }
    }
    this.left = newv;

    oldv = this.top;
    newv = oldv + dy;
    if (dy < 0) {
        // moving upward
        if (newv > oldv) {
            // negative overflow
            if (this.height >= 0) {
                this.height += newv - Number.MIN_VALUE;
                // See above comment about no overflow in this case
            }
            newv = Number.MIN_VALUE;
        }
    } else {
        // moving downward (or staying still)
        if (newv < oldv) {
            // positive overflow
            if (this.height >= 0) {
                this.height += newv - Number.MAX_VALUE;
                if (this.height < 0)
                    this.height = Number.MAX_VALUE;
            }
            newv = Number.MAX_VALUE;
        }
    }
    this.top = newv;

};
/**
 *
 * @returns {Dimension}
 */
Rectangle.prototype.getSize = function () {
    return new Dimension(this.width, this.height);
};

/**
 *
 * @param {type} d
 * @returns {undefined}
 */
Rectangle.prototype.setSize = function (d) {
    if (d.constructor.name === 'Dimension') {
        this.width = d.width;
        this.height = d.height;
    }
};
/**
 *
 * @param {Number} X The x coordinate of the Point
 * @param {Number} Y The y coordinate of the Point
 * @returns {Boolean} true if the point specified lies inside this rectangle
 */
Rectangle.prototype.containsPoint = function (X, Y) {
    if (typeof X === 'number' && typeof Y === 'number') {
        var w = this.width;
        var h = this.height;
        if ((w | h) < 0) {
            // At least one of the dimensions is negative...
            return false;
        }
        // Note: if either dimension is zero, tests below must return false...
        var x = this.left;
        var y = this.top;
        if (X < x || Y < y) {
            return false;
        }
        w += x;
        h += y;
        //    overflow || intersect
        return ((w < x || w > X) &&
            (h < y || h > Y));
    }
    return false;
};

/**
 *
 * @param {Rectangle} rect
 * @returns {Boolean} true if the specified Rectangle lies within this Rectangle.
 */
Rectangle.prototype.contains = function (rect) {
    if (rect.constructor.name === 'Rectangle') {
        var X = rect.left;
        var Y = rect.top;
        var W = rect.width;
        var H = rect.height;

        var w = this.width;
        var h = this.height;
        if ((w | h | W | H) < 0) {
            // At least one of the dimensions is negative...
            return false;
        }
        // Note: if any dimension is zero, tests below must return false...
        var x = this.left;
        var y = this.top;
        if (X < x || Y < y) {
            return false;
        }
        w += x;
        W += X;
        if (W <= X) {
            // X+W overflowed or W was zero, return false if...
            // either original w or W was zero or
            // x+w did not overflow or
            // the overflowed x+w is smaller than the overflowed X+W
            if (w >= x || W > w)
                return false;
        } else {
            // X+W did not overflow and W was not zero, return false if...
            // original w was zero or
            // x+w did not overflow and x+w is smaller than X+W
            if (w >= x && W > w)
                return false;
        }
        h += y;
        H += Y;
        if (H <= Y) {
            if (h >= y || H > h)
                return false;
        } else {
            if (h >= y && H > h)
                return false;
        }
        return true;
    }
    return false;
};


/**
 * Determines whether this Rectangle and the specified
 * Rectangle intersect. Two rectangles intersect if
 * their intersection is nonempty.
 *
 * @param {Rectangle} r the specified  Rectangle
 * @return    true if the specified  Rectangle
 *            and this Rectangle intersect;
 *             false otherwise.
 */
Rectangle.prototype.intersects = function (r) {
    if (r.constructor.name === 'Rectangle') {
        let left = r.left;
        let right = r.right();
        let top = r.top;
        let bottom = r.bottom();
        if (this.left < right && left < this.right && this.top < bottom && top < this.bottom) {
            if (this.left < left) this.left = left;
            if (this.top < top) this.top = top;
            if (this.right > right) this.right = right;
            if (this.bottom > bottom) this.bottom = bottom;
            return true;
        }
        return false;
    }
    return false;
};

/**
 * Computes the intersection of this Rectangle with the
 * specified Rectangle. Returns a new  Rectangle
 * that represents the intersection of the two rectangles.
 * If the two rectangles do not intersect, the result will be
 * an empty rectangle.
 *
 * @param {Rectangle}    r   the specified Rectangle
 * @return    the largest Rectangle contained in both the
 *            specified Rectangle and in
 *            this Rectangle; or if the rectangles
 *            do not intersect, an empty rectangle.
 */
Rectangle.prototype.intersection = function (r) {
    if (r.constructor.name === 'Rectangle') {
        var tx1 = this.left;
        var ty1 = this.top;
        var rx1 = r.left;
        var ry1 = r.top;
        var tx2 = tx1;
        tx2 += this.width;
        var ty2 = ty1;
        ty2 += this.height;
        var rx2 = rx1;
        rx2 += r.width;
        var ry2 = ry1;
        ry2 += r.height;
        if (tx1 < rx1)
            tx1 = rx1;
        if (ty1 < ry1)
            ty1 = ry1;
        if (tx2 > rx2)
            tx2 = rx2;
        if (ty2 > ry2)
            ty2 = ry2;
        tx2 -= tx1;
        ty2 -= ty1;
        // tx2,ty2 will never overflow (they will never be
        // larger than the smallest of the two source w,h)
        // they might underflow, though...
        if (tx2 < Number.MIN_VALUE)
            tx2 = Number.MIN_VALUE;
        if (ty2 < Number.MIN_VALUE)
            ty2 = Number.MIN_VALUE;
        return new Rectangle(tx1, ty1, tx2, ty2);
    }
    return null;
};

/**
 * Computes the union of this Rectangle with the
 * specified Rectangle. Returns a new
 * Rectangle that
 * represents the union of the two rectangles.
 * <p>
 * If either Rectangle has any dimension less than zero
 * the rules for non-existent rectangles
 * apply.
 * If only one has a dimension less than zero, then the result
 * will be a copy of the other {@code Rectangle}.
 * If both have dimension less than zero, then the result will
 * have at least one dimension less than zero.
 * <p>
 * If the resulting Rectangle would have a dimension
 * too large to be expressed as an int, the result
 * will have a dimension of Number.MAX_VALUE along
 * that dimension.
 * @param r the specified Rectangle
 * @return    the smallest Rectangle containing both
 *            the specified Rectangle and this
 *             Rectangle.
 */
Rectangle.prototype.union = function (r) {
    if (r.constructor.name === 'Rectangle') {
        var tx2 = this.width;
        var ty2 = this.height;
        if ((tx2 | ty2) < 0) {
            // This rectangle has negative dimensions...
            // If r has non-negative dimensions then it is the answer.
            // If r is non-existent (has a negative dimension), then both
            // are non-existent and we can return any non-existent rectangle
            // as an answer.  Thus, returning r meets that criterion.
            // Either way, r is our answer.
            return new Rectangle(r);
        }
        var rx2 = r.width;
        var ry2 = r.height;
        if ((rx2 | ry2) < 0) {
            return new Rectangle(this);
        }
        var tx1 = this.left;
        var ty1 = this.top;
        tx2 += tx1;
        ty2 += ty1;
        var rx1 = r.left;
        var ry1 = r.top;
        rx2 += rx1;
        ry2 += ry1;
        if (tx1 > rx1)
            tx1 = rx1;
        if (ty1 > ry1)
            ty1 = ry1;
        if (tx2 < rx2)
            tx2 = rx2;
        if (ty2 < ry2)
            ty2 = ry2;
        tx2 -= tx1;
        ty2 -= ty1;
        // tx2,ty2 will never underflow since both original rectangles
        // were already proven to be non-empty
        // they might overflow, though...
        if (tx2 > Number.MAX_VALUE)
            tx2 = Number.MAX_VALUE;
        if (ty2 > Number.MAX_VALUE)
            ty2 = Number.MAX_VALUE;
        return new Rectangle(tx1, ty1, tx2, ty2);
    }
    return null;
};

Rectangle.prototype.draw = function (canvasId, color, thickness) {

    if (typeof canvasId === "string" && typeof color === "string" && typeof thickness === "number") {
        var canvas = document.getElementById(canvasId);

        var ctx = canvas.getContext("2d");


        ctx.beginPath();
        ctx.lineWidth = thickness;
        ctx.strokeStyle = color;
        ctx.rect(this.left, this.top, this.width, this.height);
        ctx.stroke();
    } else {
        logger("Invalid Rectangle draw args");
    }


};


Rectangle.prototype.fill = function (canvasId, color, thickness) {

    if (typeof canvasId === "string" && typeof color === "string" && typeof thickness === "number") {
        var canvas = document.getElementById(canvasId);

        var ctx = canvas.getContext("2d");
        ctx.beginPath();
        ctx.lineWidth = thickness;
        ctx.strokeStyle = color;
        ctx.fillRect(this.left, this.top, this.width, this.height);
        ctx.stroke();
    } else {
        logger("Invalid Rectangle draw args");
    }


};

/**
 *
 * @param {FloatPoint} center
 * @param {Number} width
 * @param {Number} height
 * @returns {EllipseModel}
 */
function EllipseModel(center, width, height) {
    if (center && center.constructor.name === 'FloatPoint' && typeof width === 'number' && typeof height === 'number') {
        this.center = center;
        this.size = new Dimension(width, height);
    } else {
        this.center = new FloatPoint(0, 0, 0);
        this.size = new Dimension(0, 0);
    }

    var r = new Rect();
}


/**
 * The largest rectangle that can be inscribed in an ellipse
 * is a rectangle of area 2.a.b where 'a' is the half-length of the major axis and
 * 'b' is the half-length of the minor axis.
 * @return the biggest rectangle that can be inscribed in the ellipse
 */
EllipseModel.prototype.getBiggestRectangle = function () {
    var r = new Rectangle();
    r.x = (this.center.x - 0.5 * this.size.width * Math.sqrt(2));
    r.y = (this.center.y - 0.5 * this.size.height * Math.sqrt(2));
    r.width = (this.size.width * Math.sqrt(2));
    r.height = (this.size.height * Math.sqrt(2));
    return r;
};

EllipseModel.prototype.area = function () {
    return Math.PI * this.size.width * this.size.height;
};


/**
 *
 * @param {Number} y the y coordinate of
 * a given point on an ellipse.
 * @return the 2 possible x coordinates of that point in a number array.
 */
EllipseModel.prototype.getX = function (y) {
    var x = [];
    var evalYPart = Math.pow((y - this.center.y) / this.size.height, 2);
    x.push(this.center.x + this.size.width * sqrt(1 - evalYPart));
    x.push(this.center.x - this.size.width * sqrt(1 - evalYPart));
    return x;
};

/**
 *
 * @param {Number} x the x coordinate of
 * a given point on an ellipse.
 * @return the 2 possible y coordinates of that point.
 */
EllipseModel.prototype.getY = function (x) {
    var y = [];

    var evalXPart = pow((x - this.center.x) / this.size.width, 2);

    y.push(this.center.y + this.size.height * sqrt(1 - evalXPart));
    y.push(this.center.y - this.size.height * sqrt(1 - evalXPart));

    return y;
};

/**
 *
 * @param {FloatPoint} p the Point to check if or not it lies on the EllipseModel
 * @return true if it lies on the EllipseModel object or deviates from its
 * equation by 1.0E-14 or lesser.
 */
EllipseModel.prototype.isOnEllipse = function (p) {
    var val = Math.pow(((p.x - this.center.x) / this.size.width), 2) + Math.pow(((p.y - this.center.y) / this.size.height), 2);
    return approxEquals(val, 1);
};


/**
 * The theory behind this is that for a point to be inside an ellipse, a
 * line that passes through the center of the ellipse and this point will
 * cut the ellipse at 2 points such that the point will lie in between both
 * points.
 *
 * @param {FloatPoint} p the Point object
 * @return true if the Point object is located inside this EllipseModel
 * object.
 */
EllipseModel.prototype.contains = function (p) {
    if (p.constructor.name === 'FloatPoint') {
        var line = new Line(p, this.center);
        var x1 = 0;
        var y1 = 0;
        var x2 = 0;
        var y2 = 0;
        var soln = lineIntersection(line);

        x1 = parseFloat(soln[0]);
        y1 = parseFloat(soln[1]);
        x2 = parseFloat(soln[2]);
        y2 = parseFloat(soln[3]);

        var truly1 = ((x1 <= p.x && x2 >= p.x) || (x2 <= p.x && x1 >= p.x));
        var truly2 = ((y1 <= p.y && y2 >= p.y) || (y2 <= p.y && y1 >= p.y));

        return truly1 && truly2;
    } else {
        return false;
    }
};


/**
 *
 * @param {Line} line the Line object that cuts this EllipseModel
 * @return the possible coordinates of the points where the Line object cuts this EllipseModel object
 * The result is returned in the format:
 * Let the solution array be array[], then:
 *
 * array[0] = x coordinate of the first point;
 * array[1] = y coordinate of the first point;
 * array[2] = x coordinate of the second point;
 * array[3] = y coordinate of the second point;
 *
 * The coordinates are returned as strings
 * to account for complex solutions too.
 *
 * THIS METHOD WILL RETURN A NULL ARRAY AND THROW
 * IF NO INTERSECTION
 * OCCURS.
 */
EllipseModel.prototype.lineIntersection = function (line) {
    if (line.constructor.name === 'Line') {
        var str = [];
        var m = line.m;
        var c = line.c;


        var A = pow(this.size.height, 2) + pow(this.size.width * m, 2);
        var B = 2 * (pow(this.size.width, 2) * m * (c - this.center.y) - pow(this.size.height, 2) * this.center.x);
        var C = pow(this.center.x * this.size.height, 2) + pow(this.size.width, 2) * (pow(c - this.center.y, 2) - pow(this.size.height, 2));
        var quad = new Quadratic(A, B, C);
        var str1 = quad.solutionArray();

        try {
            str[0] = str1[0];
            str[1] = str1[1];
            str[2] = String.valueOf(m * parseFloat(str1[0]) + c);
            str[3] = String.valueOf(m * parseFloat(str1[1]) + c);

            var str1 = [];

            str1[0].push(str[0]);
            str1[1].push(str[2]);
            str1[2].push(str[1]);
            str1[3].push(str[3]);

        }//end try
        catch (e) {
            str1 = null;
            str = null;
        }//end catch


        return str1;
    }
    return null;
};//end method


/**
 *
 * @param {Line} line The Line object
 * @return true if the EllipseModel object
 * intersects with th Line object.
 */
EllipseModel.prototype.intersectsWithLine = function (line) {
    if (line.constructor.name === 'Line') {
        var intersects = false;
        try {
            var c = lineIntersection(line);
            for (var i = 0; i < c.length; i++) {
                var val = c[i];
                intersects = true;//if a null value is detected, then no intersection occurs.
            }
        } catch (e) {
            intersects = false;
        }
        return intersects;
    }
    return false;
};


/**
 *
 * @param {EllipseModel} ellipse The EllipseModel object whose size is to
 * be compared with this one.
 * @return true if the parameter EllipseModel object is bigger than this EllipseModel object
 */
EllipseModel.prototype.isBiggerThan = function (ellipse) {
    return this.area() > ellipse.area();
};
/**
 *
 * @param {EllipseModel} ellipse The EllipseModel object whose size is to
 * be compared with this one.
 * @return true if the parameter EllipseModel object is smaller than this EllipseModel object
 */
EllipseModel.prototype.isSmallerThan = function (ellipse) {
    return this.area() < ellipse.area();
};
/**
 * Returns true if their areas deviate by 1.0E-14 or lesser.
 * @param {EllipseModel} ellipse the EllipseModel object whose size is to be compared with this EllipseModel object.
 * @return true if their sizes are the same or deviate by 1.0E-14 or lesser
 */
EllipseModel.prototype.hasAlmostSameSizeAs = function (ellipse) {
    return approxEquals(this.area(), ellipse.area());
};
/**
 * Returns true if their areas are exactly equal.
 * This method can be tricky at times and may produce slight errors if
 * truncation errors have occured or rounding errors.
 * YOU CAN USE METHOD hasAlmostSameSizeAs to reduce this likelihood.
 * That method will still return true for deviations of 1.0E-14 and lesser.
 * @param {EllipseModel} ellipse the EllipseModel object whose size is to be compared with this EllipseModel object.
 * @return true if their areas are exactly equal.
 */
EllipseModel.prototype.hasSameSizeAs = function (ellipse) {
    return this.area() === ellipse.area();
};


/**
 *
 * @param {Rectangle} rect The rectangle
 * @return an array of FloatPoint objects
 * constituting the points of intersection between this
 * EllipseModel object and the rectangle.
 */
EllipseModel.prototype.intersection = function (rect) {
    var pt = new FloatPoint(rect.x, rect.y);
    var rectSize = rect.getSize();
    var A = pt.x;
    var B = pt.y;
    var h = this.center.x;
    var k = this.center.y;
    var W = rectSize.width;
    var H = rectSize.height;
    var a = getWidth();
    var b = getHeight();


    var pts = [];
    var p1 = [new FloatPoint(), new FloatPoint()];//intersection of the top line of the rectangle with the ellipse
    var p2 = [new FloatPoint(), new FloatPoint()];//intersection of the bottom line  of the rectangle with the ellipse
    var p3 = [new FloatPoint(), new FloatPoint()];//intersection of the left line  of the rectangle with the ellipse
    var p4 = [new FloatPoint(), new FloatPoint()]; //intersection of the right line  of the rectangle with the ellipse
    var val = 0;

    try {
        val = a * sqrt(1 - pow((B - k) / b, 2));
        p1[0].x = (h + val);
        p1[0].y = (B);
        p1[1].x = (h - val);
        p1[1].y = (B);
        if (p1[0] !== null && !Number.isNaN(p1[0].x) && !Number.isNaN(p1[0].y)) {
            pts.add(p1[0]);
        }
        if (p1[1] !== null && !Number.isNaN(p1[1].x) && !Number.isNaN(p1[1].y)) {
            pts.add(p1[1]);
        }
    } catch (e) {

    }

    try {
        val = a * Math.sqrt(1 - pow((B + H - k) / b, 2));
        p2[0].x = (h + val);
        p2[0].y = (B + H);
        p2[1].x = (h - val);
        p2[1].y = (B + H);
        if (p2[0] !== null && !Number.isNaN(p2[0].x) && !Number.isNaN(p2[0].y)) {
            pts.add(p2[0]);
        }
        if (p2[1] !== null && !Number.isNaN(p2[1].x) && !Number.isNaN(p2[1].y)) {
            pts.add(p2[1]);
        }
    } catch (ex) {

    }

    try {
        val = b * Math.sqrt(1 - pow((A - h) / a, 2));
        p3[0].x = A;
        p3[0].y = k + val;
        p3[1].x = A;
        p3[1].y = k - val;
        if (p3[0] !== null && !Number.isNaN(p3[0].x) && !Number.isNaN(p3[0].y)) {
            pts.add(p3[0]);
        }
        if (p3[1] !== null && !Number.isNaN(p3[1].x) && !Number.isNaN(p3[1].y)) {
            pts.add(p3[1]);
        }
    } catch (arit) {

    }

    try {
        val = b * sqrt(1 - pow((A + W - h) / a, 2));
        p4[0].x = (A + W);
        p4[0].y = (k + val);
        p4[1].x = (A + W);
        p4[1].y = (k - val);
        if (p4[0] !== null && !Number.isNaN(p4[0].x) && !Number.isNaN(p4[0].y)) {
            pts.add(p4[0]);
        }
        if (p4[1] !== null && !Number.isNaN(p4[1].x) && !Number.isNaN(p4[1].y)) {
            pts.add(p4[1]);
        }
    } catch (arit1) {

    }


    return pts;
};

/**
 *
 * @param {Rectangle} rect The intersecting rectangle
 * @return true if the rectangle intersects with this Ellipse object.
 */
EllipseModel.prototype.intersectsWithRect = function (rect) {
    var pt = new FloatPoint(rect.x, rect.y);
    var rectSize = rect.getSize();
    var A = pt.x;
    var B = pt.y;
    var h = getXCenter();
    var k = getYCenter();
    var W = rectSize.getWidth();
    var H = rectSize.height;
    var a = getWidth();
    var b = getHeight();


    var p1 = [new FloatPoint(), new FloatPoint()];//intersection of the top line of the rectangle with the ellipse
    var p2 = [new FloatPoint(), new FloatPoint()];//intersection of the bottom line  of the rectangle with the ellipse
    var p3 = [new FloatPoint(), new FloatPoint()];//intersection of the left line  of the rectangle with the ellipse
    var p4 = [new FloatPoint(), new FloatPoint()]; //intersection of the right line  of the rectangle with the ellipse
    var val = 0;
    var intersects1 = false;
    var intersects2 = false;
    var intersects3 = false;
    var intersects4 = false;

    try {
        val = a * Math.sqrt(1 - pow((B - k) / b, 2));
        p1[0].x = (h + val);
        p1[0].y = (B);
        p1[1].x = (h - val);
        p1[1].y = (B);
        if ((rect.containsPoint(p1[0].x, p1[0].y) && this.contains(p1[0])) ||
            (rect.containsPoint(p1[1].x, p1[1].y) && this.contains(p1[1]))) {
            intersects1 = true;
        }
    } catch (arit) {

    }

    try {
        val = a * Math.sqrt(1 - pow((B + H - k) / b, 2));
        p2[0].x = (h + val);
        p2[0].y = (B + H);
        p2[1].x = (h - val);
        p2[1].y = (B + H);
        if ((rect.containsPoint(p2[0].x, p2[0].y) && this.contains(p2[0])) ||
            (rect.containsPoint(p2[1].x, p2[1].y) && this.contains(p2[1]))) {
            intersects2 = true;
        }
    } catch (arit) {

    }

    try {
        val = b * Math.sqrt(1 - pow((A - h) / a, 2));
        p3[0].x = (A);
        p3[0].y = (k + val);
        p3[1].x = (A);
        p3[1].y = (k - val);
        if ((rect.containsPoint(p3[0].x, p3[0].y) && this.contains(p3[0])) ||
            (rect.containsPoint(p3[1].x, p3[1].y) && this.contains(p3[1]))) {
            intersects3 = true;
        }
    } catch (arit) {

    }

    try {
        val = b * Math.sqrt(1 - pow((A + W - h) / a, 2));
        p4[0].x = (A + W);
        p4[0].y = (k + val);
        p4[1].x = (A + W);
        p4[1].y = (k - val);
        if ((rect.containsPoint(p4[0].x, p4[0].y) && this.contains(p4[0])) ||
            (rect.containsPoint(p4[1].x, p4[1].y) && this.contains(p4[1]))) {
            intersects4 = true;
        }
    } catch (arit) {

    }


    return intersects1 || intersects2 || intersects3 || intersects4;
};


/**
 *
 * @param {EllipseModel} ellipse The EllipseModel object.
 * @return true if this object intersects with or is contained within the
 * given EllipseModel object and vice versa.
 */
EllipseModel.prototype.intersectsWith = function (ellipse) {

    var line = new Line(this.center, ellipse.center);

    //The 2 centers coincide
    if (this.center.equals(ellipse.center)) {
        return true;
    }

    //String soln[] = this.lineIntersection(line);

    var otherSoln = ellipse.lineIntersection(line);
    try {
        //Point p1 = new Point( Double.valueOf(soln[0]) , Double.valueOf(soln[1]) );
        //Point p2 = new Point( Double.valueOf(soln[2]) , Double.valueOf(soln[3]) );

        var p3 = new FloatPoint(parseFloat(otherSoln[0]), parseFloat(otherSoln[1]));
        var p4 = new FloatPoint(parseFloat(otherSoln[2]), parseFloat(otherSoln[3]));

        if ((this.contains(p3) || this.contains(p4))) {
            return true;
        }//end if
        else {
            return false;
        }
    }//end try
    catch (num) {
        return false;
    }//end catch

};//end method


function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

function rgbToHEX(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRGB(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
        a: 1.0
    } : null;
}
/**
 * 
 * @param {string} color A color string  e.g rgb(22,13,240) or rgba(122,103,240, 0.5) or #22FF88 
 * @returns the red, green and blue values and the alpha also if present
 */
function getRGB(color) {
    if (!color) {
        throw 'supply a color';
    }
    color = color.toLowerCase().trim();


    if (color.indexOf('rgb') === 0) {
        var i = color.indexOf("(");
        var j = color.indexOf(")");
        if (i === -1 || j === -1) { throw 'invalid rgb|rgba color'; }
        color = color.substring(i + 1, j).split(',');
        return color.length === 3 ? {
            r: parseInt(color[0]),
            g: parseInt(color[1]),
            b: parseInt(color[2]),
            a: 1.0
        } : {
            r: parseInt(color[0]),
            g: parseInt(color[1]),
            b: parseInt(color[2]),
            a: parseFloat(color[3])
        }
    } else {
        return hexToRGB(color);
    }
}




// Using Math.round() will give you a non-uniform distribution!
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function Random() {

}

Random.prototype.nextInt = function (max) {
    return randomInt(0, max - 1);
};

Random.prototype.nextBool = function () {
    return randomInt(0, 1) === 1;
};

Random.prototype.generateUUID = function () { // Public Domain/MIT
    var d = new Date().getTime();//Timestamp
    var d2 = (performance && performance.now && (performance.now() * 1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16;//random number between 0 and 16
        if (d > 0) {//Use timestamp until depleted
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else {//Use microseconds since page-load if supported
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};


/**
 *
 * @returns {Number}
 */
function oneDegInRads() {
    return (Math.PI / 180.0);
}

/**
 *
 * @param {type} angdeg
 * @returns {Number}
 */
function angDegToRads(angdeg) {
    return (angdeg * Math.PI / 180.0);
}

/**
 *
 * @param {type} angrad
 * @returns {Number}
 */
function angRadToDegs(angrad) {
    return (180 * angrad / Math.PI);
}


/**
 *
 * @param num1 The first number
 * @param num2 The second number
 * @return true if the two numbers are equal.
 */
function equals(num1, num2) {
    return Math.abs(Math.abs(num1) - Math.abs(num2)) <= 1.0E-10;
}


function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) {
        /* if present, the header is where you move the DIV from:*/
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        /* otherwise, move the DIV from anywhere inside the DIV:*/
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // set the element's new position:
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        /* stop moving when mouse button is released:*/
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


// Graphics module

/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
const PIXEL_RATIO = (function () {
    let ctx = document.createElement("canvas").getContext("2d"),
        dpr = window.devicePixelRatio || window.webkitDevicePixelRatio || window.mozDevicePixelRatio || 1,
        bsr = ctx.webkitBackingStorePixelRatio ||
            ctx.mozBackingStorePixelRatio ||
            ctx.msBackingStorePixelRatio ||
            ctx.oBackingStorePixelRatio ||
            ctx.backingStorePixelRatio || 1;

    return dpr / bsr;
})();

const Gravity = {
    LEFT: "left",
    RIGHT: "right",
    CENTER: "center"
};


const FontStyle = {
    REGULAR: "normal",
    OBLIQUE: "oblique",
    ITALIC: "italic",
    BOLD: "bold",
    BOLDER: "bolder",
    LIGHTER: "lighter",
    REGULAR_100: "100",
    REGULAR_200: "200",
    REGULAR_300: "300",
    REGULAR_400: "400",
    REGULAR_500: "500",
    REGULAR_600: "600",
    REGULAR_700: "700",
    REGULAR_800: "800",
    REGULAR_900: "900",
    ITALIC_100: "italic 100",
    ITALIC_200: "italic 200",
    ITALIC_300: "italic 300",
    ITALIC_400: "italic 400",
    ITALIC_500: "italic 500",
    ITALIC_600: "italic 600",
    ITALIC_700: "italic 700",
    ITALIC_800: "italic 800",
    ITALIC_900: "italic 900",
    OBLIQUE_100: "oblique 100",
    OBLIQUE_200: "oblique 200",
    OBLIQUE_300: "oblique 300",
    OBLIQUE_400: "oblique 400",
    OBLIQUE_500: "oblique 500",
    OBLIQUE_600: "oblique 600",
    OBLIQUE_700: "oblique 700",
    OBLIQUE_800: "oblique 800",
    OBLIQUE_900: "oblique 900",
    BOLD_ITALIC: "italic bold",
    BOLDER_ITALIC: "italic bolder",
    LIGHTER_ITALIC: "italic lighter",
    BOLD_OBLIQUE: "oblique bold",
    BOLDER_OBLIQUE: "oblique bolder",
    LIGHTER_OBLIQUE: "oblique lighter"
};

const FontStyleValues = getObjectValues(FontStyle).sort(function (a, b) {
    return b.length - a.length;
});

/**
 *
 * @param {Array} xpoints
 * @param {Array} ypoints
 * @param {Number} npoints
 * @returns {Polygon}
 */
function Polygon(xpoints, ypoints, npoints) {

    this.bounds = new Rectangle();
    if (xpoints && ypoints && xpoints.length !== ypoints.length) {
        logger('xpoints and ypoints must have the same size.');
        return;
    }

    if (Object.prototype.toString.call(xpoints) !== '[object Array]') {
        logger('xpoints must be an array of integer numbers');
        this.xpoints = [];
    } else {
        this.xpoints = xpoints;
    }
    if (Object.prototype.toString.call(ypoints) !== '[object Array]') {
        logger('ypoints must be an array of integer numbers');
        this.ypoints = [];
    } else {
        this.ypoints = ypoints;
    }
    if (typeof npoints !== 'number') {
        logger('npoints must be an integer number');
        npoints = this.xpoints.length;
    } else {
        this.npoints = npoints;
    }
}

/**
 *
 * @param {Number} x The x coordinate of the Point
 * @param {Number} y The y coordinate of the Point
 * @returns {undefined}
 */
Polygon.prototype.addPoint = function (x, y) {
    if (typeof x !== 'number') {
        throw ('x must be an integer number');
    }
    if (typeof y !== 'number') {
        throw ('y must be an integer number');
    }
    this.xpoints.push(x);
    this.ypoints.push(y);

    this.npoints += 1;
};

/**
 * Add an array of points to the Polygon
 * @param {Array} xpts The array of x points
 * @param {Array} ypts The array of y points
 * @returns {undefined}
 */
Polygon.prototype.addPoints = function (xpts, ypts) {
    if (Object.prototype.toString.call(xpts) !== '[object Array]') {
        logger('xpts must be an array of integer numbers');
        return;
    }
    if (Object.prototype.toString.call(ypts) !== '[object Array]') {
        logger('ypts must be an array of integer numbers');
        return;
    }

    if (xpts.length === ypts.length) {
        Array.prototype.push.apply(this.xpoints, xpts);
        Array.prototype.push.apply(this.ypoints, ypts);
        this.npoints += xpts.length;
    } else {
        logger('xpts and ypts must have the same length');
    }

};


/**
 *
 * @param {Number} x The x coordinate of a point
 * @param {Number} y The y coordinate of a point
 * @returns {Number|Boolean}
 */
Polygon.prototype.contains = function (x, y) {
    if (this.npoints <= 2 || !this.getBoundingBox().contains(x, y)) {
        return false;
    }
    var hits = 0;

    var lastx = xpoints[npoints - 1];
    var lasty = ypoints[npoints - 1];
    var curx, cury;

    // Walk the edges of the polygon
    for (var i = 0; i < npoints; i++) {
        curx = xpoints[i];
        cury = ypoints[i];

        if (cury === lasty) {
            continue;
        }

        var leftx;
        if (curx < lastx) {
            if (x >= lastx) {
                continue;
            }
            leftx = curx;
        } else {
            if (x >= curx) {
                continue;
            }
            leftx = lastx;
        }

        var test1, test2;
        if (cury < lasty) {
            if (y < cury || y >= lasty) {
                continue;
            }
            if (x < leftx) {
                hits++;
                continue;
            }
            test1 = x - curx;
            test2 = y - cury;
        } else {
            if (y < lasty || y >= cury) {
                continue;
            }
            if (x < leftx) {
                hits++;
                continue;
            }
            test1 = x - lastx;
            test2 = y - lasty;
        }

        if (test1 < (test2 / (lasty - cury) * (lastx - curx))) {
            hits++;
        }
    }
    lastx = curx;
    lasty = cury;
    return ((hits & 1) !== 0);
};

Polygon.prototype.getBoundingBox = function () {
    if (this.npoints === 0) {
        return new Rectangle();
    }
    if (bounds === null) {
        this.calculateBounds(this.xpoints, this.ypoints, this.npoints);
    }
    return this.bounds.getBounds();
};

/*
 * Calculates the bounding box of the points passed to the constructor.
 * Sets {@code bounds} to the result.
 * @param {Array} xpts array of <i>x</i> coordinates
 * @param {Array} ypts array of <i>y</i> coordinates
 * @param {Number} npoints the total number of points
 */
Polygon.prototype.calculateBounds = function (xpts, ypts, npts) {
    if (Object.prototype.toString.call(xpts) !== '[object Array]') {
        logger('xpts must be an array of integer numbers');
        return;
    }
    if (Object.prototype.toString.call(ypts) !== '[object Array]') {
        logger('ypts must be an array of integer numbers');
        return;
    }
    if (typeof npts !== 'number') {
        logger('npts must be an integer number');
    }
    var boundsMinX = Number.MAX_VALUE;
    var boundsMinY = Number.MAX_VALUE;
    var boundsMaxX = Number.MIN_VALUE;
    var boundsMaxY = Number.MIN_VALUE;

    for (var i = 0; i < npoints; i++) {
        var x = xpts[i];
        boundsMinX = Math.min(boundsMinX, x);
        boundsMaxX = Math.max(boundsMaxX, x);
        var y = ypts[i];
        boundsMinY = Math.min(boundsMinY, y);
        boundsMaxY = Math.max(boundsMaxY, y);
    }
    this.bounds = new Rectangle(boundsMinX, boundsMinY,
        boundsMaxX,
        boundsMaxY);
};

/*
 * Resizes the bounding box to accommodate the specified coordinates.
 * @param x,&nbsp;y the specified coordinates
 */
Polygon.prototype.updateBounds = function (x, y) {
    if (x < this.bounds.x) {
        this.bounds.width = this.bounds.width + (this.bounds.x - x);
        this.bounds.x = x;
    } else {
        this.bounds.width = Math.max(this.bounds.width, x - this.bounds.x);
    }

    if (y < this.bounds.y) {
        this.bounds.height = this.bounds.height + (this.bounds.y - y);
        this.bounds.y = y;
    } else {
        this.bounds.height = Math.max(this.bounds.height, y - this.bounds.y);
    }
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 *
 * @param {string} style
 * @param {Number} size
 * @param {string} name
 * @param {Object} sizeUnits
 * @param {string} variant
 * @returns {Font}
 */
function Font(style, size, name, sizeUnits, variant) {
    this.style = style;
    this.size = size;
    this.name = name;
    this.variant = variant ? variant : null;

    if (typeof sizeUnits === 'undefined') {
        this.sizeUnits = CssSizeUnits.EM;
    } else {
        this.sizeUnits = sizeUnits;
    }
}

Font.prototype.string = function () {
    if (this.variant && this.variant !== 'normal') {
        return this.variant + ' ' + this.style + ' ' + this.size * PIXEL_RATIO + this.sizeUnits + ' ' + this.name;
    } else {
        return this.style + ' ' + this.size * PIXEL_RATIO + this.sizeUnits + ' ' + this.name;
    }

};

Font.prototype.getSize = function () {
    return this.size;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


createHiDPICanvas = function (canvas, w, h, ratio) {
    if (!ratio) {
        ratio = PIXEL_RATIO;
    }
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    return canvas;
};

/**
 * dpr is not yet fully applied to canvas.
 * Use this answer to sort this out later... https://stackoverflow.com/a/62028950/1845404.
 * The issue is that this might be on a case by case basis.
 * You can scale, translate, and rotate the drawing coordinates via the canvas transform.
 *
 * If you have the min and max coordinates of your drawing
 *
 * Example:
 *
 * const min = {x: 100, y: 200};
 * const max = {x: 10009, y: 10000};
 * You can make it fit the canvas as follows
 *
 * const width = canvas.width;
 * const height = canvas.height;
 *
 * // get a scale to best fit the canvas
 * const scale = Math.min(width / (max.x - min.x), height / (max.y - min.y));
 *
 * // get a origin so that the drawing is centered on the canvas
 * const top = (height - (max.y - min.y)) / 2;
 * const left = (width - (max.x - min.x)) / 2;
 *
 * // set the transform so that you can draw to the canvas
 * ctx.setTransform(scale, 0, 0, scale, left, top);
 *
 * // draw something
 * ctx.strokeRect(min.x, min.y, max.x - min.x, max.y - min.y);
 * @param canvas
 * @constructor
 */
function Graphics(canvas) {
    let dpr = PIXEL_RATIO;
    //canvas = createHiDPICanvas(canvas , canvas.offsetWidth , canvas.offsetHeight, scaleFactor );
    this.ctx = canvas.getContext('2d');

    {
        // Get the size of the canvas in CSS pixels.
        let canvasRect = canvas.getBoundingClientRect();

        // Give the canvas pixel dimensions of their CSS
        // size * the device pixel ratio.
        canvas.width = Math.round(canvasRect.right * dpr) - Math.round(canvasRect.left * dpr);
        canvas.height = Math.round(canvasRect.bottom * dpr) - Math.round(canvasRect.top * dpr);

        canvas.style.width = canvasRect.width + 'px';
        canvas.style.height = canvasRect.height + 'px';

        // Scale all drawing operations by the dpr, so you
        // don't have to worry about the difference.
        // this.ctx.scale(dpr, dpr);
        this.ctx.scale(1, 1);
    }


    this.ctx.strokeStyle = "#000";
    this.ctx.lineWidth = 1;
    this.ctx.globalAlpha = 1.0;
    this.ctx.fillStyle = "#FFF";
    this.ctx.font = "bold 0.9em Arial";

    //canvas = createHiDPICanvas(canvas , canvas.offsetWidth , canvas.offsetHeight, 1 );

    this.width = canvas.width;
    this.height = canvas.height;

    // For quick reuse when drawing many pixels
    this.imageCacheUnitPx = this.createImageData(1, 1);
    this.imageCacheQuadPx = this.createImageData(2, 2);
}

/**
 * @param {number} width The width of the canvas to be created
 * @param {number} height The height of the canvas to be created
 * @returns a new Graphics object based on a dynamically created canvas
 */
function NewGraphics(width, height) {
    var c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    if (!c.isConnected) {
        document.body.appendChild(c);
    }
    return new Graphics(c); //return canvas element
}

Graphics.prototype.destroy = function () {
    this.ctx.canvas = null;
    this.ctx = null;
    this.width = this.height = null;
};

Graphics.prototype.clear = function () {
    // clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);
};
/**
 *
 * @returns {HTMLCanvasElement}
 */
Graphics.prototype.getCanvas = function () {
    return this.ctx.canvas;
};
/**
 * Changes may occur to the canvas, such as stretching due to changing the css width or height(e.g when the screen is resized or rotated)
 * Call this method to force the Graphics object to scale with the dimensions of the canvas accordingly
 */
Graphics.prototype.reloadCanvas = function () {
    let canvas = this.getCanvas();
    const dpr = PIXEL_RATIO;


    {
        // Get the size of the canvas in CSS pixels.
        let canvasRect = canvas.getBoundingClientRect();

        // Give the canvas pixel dimensions of their CSS
        // size * the device pixel ratio.
        canvas.width = canvasRect.width * dpr;
        canvas.height = canvasRect.height * dpr;


        // Scale all drawing operations by the dpr, so you
        // don't have to worry about the difference. Nah!!!
        this.ctx.scale(1, 1);

        canvas.style.width = canvasRect.width + 'px';
        canvas.style.height = canvasRect.height + 'px';

    }

    this.width = canvas.width;
    this.height = canvas.height;
};


Graphics.prototype.scale = function (w, h) {
    this.ctx.scale(w, h);
};


/**
 *
 * @param {Font} font
 * @returns {undefined}
 */
Graphics.prototype.setFont = function (font) {
    if (font.constructor.name === 'Font') {
        this.ctx.font = font.string();
    }
};

/**
 *
 * @returns the stringified font as passed to the context
 */
Graphics.prototype.getFont = function () {
    return this.ctx.font;
};


/**
 * Rotates the current drawing context in radians
 * @param {number} angleRads The angle in radians
 * @returns {undefined}
 */
Graphics.prototype.rotate = function (angleRads) {
    if (angleRads) {
        if (typeof angleRads === "number") {
            this.ctx.rotate(angleRads);//angRad = angleDeg * Math.PI / 180;
        } else {
            throw "Invalid angle specified!";
        }
    } else {
        throw "No angle specified!";
    }
};

/**
 * Rotates the current drawing context in degrees
 * @param {number} angleDegs The angle in degrees
 * @returns {undefined}
 */
Graphics.prototype.rotateDegs = function (angleDegs) {
    this.rotate(angleDegs * Math.PI / 180.0);
};


/**
 * Rotates the current drawing context in radians about a certain point(x,y)
 * Helps the developer restore the canvas after rotating at some point other than
 * the normal center of rotation.
 * The developer only needs specify what they wish to perform after rotation.
 * This code will:
 * 1. rotate the canvas about the new origin specified
 * 2. run the task the developer wishes to perform
 * 3. Restore the original center of rotation
 *
 * In Andfroid rotate(angle, x, y) is implemented like this:
 *
 *      translate(x, y);
 rotate(degrees);
 translate(-x, -y);
 *
 * If no task is specified, the rotation will be performed, but the developer has to restore the default center of rotation(0,0)
 * later on in their own code. If not, the drawings will always be rotated henceforth.
 * @param {number} angleRads The angle in radians
 * @param {number} x The x location of the center of rotation
 * @param {number} y The y location of the center of rotation
 * @param {function} task A task to run after rotation, so the canvas can be restored to its original center of rotation
 * @returns {undefined}
 */
Graphics.prototype.rotateAt = function (angleRads, x, y, task) {
    if (typeof angleRads === "number") {
        this.ctx.save();
        // move the origin to a new point
        this.ctx.translate(x, y);
        this.ctx.rotate(angleRads);//angRad = angleDeg * Math.PI / 180;
        if (typeof task === "function") {
            task();
        }
        // this.ctx.rotate(-angleRads);
        //this.ctx.translate(-x, -y);
        this.ctx.restore();
        if (typeof task !== "function") {
            throw "`task` should be a function!";
        }
    } else {
        throw "Invalid angle specified!";
    }
};

/**
 *  Rotates the current drawing context in degrees about a certain point(x,y)
 * Helps the developer restore the canvas after rotating at some point other than
 * the normal center of rotation.
 * The developer only needs specify what they wish to perform after rotation.
 * This code will:
 * 1. rotate the canvas about the new origin specified
 * 2. run the task the developer wishes to perform
 * 3. Restore the original center of rotation
 *
 * If no task is specified, the rotation will be performed, but the developer has to restore the default center of rotation(0,0)
 * later on in their own code. If not, the drawings will always be rotated henceforth.
 * @param {number} angleDegs The angle in degrees
 * @param {number} x The x location of the center of rotation
 * @param {number} y The y location of the center of rotation
 * @param {function} task A task to run after rotation, so the canvas can be restored to its original center of rotation
 * @returns {undefined}
 */
Graphics.prototype.rotateDegsAt = function (angleDegs, x, y, task) {
    if (angleDegs === 0) {
        task();
        return;
    }
    this.rotateAt(angleDegs * Math.PI / 180.0, x, y, task);
};

/**
 *
 * @param {string} color
 * @returns {undefined}
 */
Graphics.prototype.setColor = function (color) {
    if (typeof color === 'string') {
        this.ctx.strokeStyle = color;
    }
};

/**
 *
 * @param {string} bg
 * @returns {undefined}
 */
Graphics.prototype.setBackground = function (bg) {
    if (typeof bg === 'string') {
        this.ctx.fillStyle = bg;
    }
};


Graphics.prototype.setTextBaseLine = function (baseline) {
    this.ctx.textBaseline = baseline;
};


Graphics.prototype.setTextAlign = function (txtAlign) {
    this.ctx.textAlign = txtAlign;
};

/**
 *
 * @param {Number} strokeWidth
 * @returns {undefined}
 */
Graphics.prototype.setStrokeWidth = function (strokeWidth) {
    if (typeof strokeWidth === 'number') {
        this.ctx.lineWidth = strokeWidth;
    }
};
/**
 *
 * @returns {Number} strokeWidth
 */
Graphics.prototype.getStrokeWidth = function () {
    return this.ctx.lineWidth;
};

Graphics.prototype.getStrokeColor = function () {
    return this.ctx.strokeStyle;
};
Graphics.prototype.getFillColor = function () {
    return this.ctx.fillStyle;
};

/**
 *
 * @param {Number} alpha A number between 0 and 1
 * @returns {undefined}
 */
Graphics.prototype.setAlpha = function (alpha) {
    if (typeof alpha === 'number') {
        this.ctx.globalAlpha = alpha;
    }
};

Graphics.prototype.getAlpha = function () {
    return this.ctx.globalAlpha;
};

/**
 * ctx.lineJoin = "bevel" || "round" || "miter";
 * @param {string} lineJoinStyle
 * @returns {undefined}
 */
Graphics.prototype.lineJoinStyle = function (lineJoinStyle) {
    if (typeof lineJoinStyle === 'string') {
        this.ctx.lineJoin = lineJoinStyle;
    }
};

/**
 * ctx.lineCap = "butt" || "round" || "square";
 * @param {string} lineCapStyle
 * @returns {undefined}
 */
Graphics.prototype.lineCapStyle = function (lineCapStyle) {
    if (typeof lineCapStyle === 'string') {
        this.ctx.lineCap = lineCapStyle;
    }
};

Graphics.prototype.normalizeQuantity = function (qty) {
    if (typeof qty === 'number') {
        return qty * PIXEL_RATIO;
    }
    throw new Error("Only numbers can be normalized");
};


/**
 * Draws a rectangular shape's outline
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.drawRect = function (x, y, width, height) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number') {
        this.ctx.strokeRect(x, y, PIXEL_RATIO * width, PIXEL_RATIO * height);
    }
};


/**
 * Fills a rectangular shape with color
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRect = function (x, y, width, height) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number') {
        this.ctx.fillRect(x, y, PIXEL_RATIO * width, PIXEL_RATIO * height);
    }
};


/**
 * Draws a rectangular shape's outline
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.drawPoint = function (x, y) {
    if (typeof x === 'number' && typeof y === 'number') {

        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + 0.1, y);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};

Graphics.prototype.beginPath = function () {
    this.ctx.beginPath();
};
/**
 *
 * @param x
 * @param y
 */
Graphics.prototype.moveTo = function (x, y) {
    if (typeof x === 'number' && typeof y === 'number') {
        this.ctx.moveTo(x, y);
    }
};

/**
 *
 * @param x
 * @param y
 */
Graphics.prototype.lineTo = function (x, y) {
    if (typeof x === 'number' && typeof y === 'number') {
        this.ctx.lineTo(x, y);
    }
};


/**
 *
 */
Graphics.prototype.closePath = function () {
    this.ctx.closePath();
};

Graphics.prototype.stroke = function () {
    this.ctx.stroke();
};

Graphics.prototype.fill = function () {
    this.ctx.fill();
};

/**
 * Draws a rectangular shape's outline
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.drawRoundRect = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.closePath();


        this.ctx.stroke();


    }
};


/**
 * Fills a rectangular shape's outline
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRoundRect = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.fill();


    }
};


/**
 * Fills a rectangular shape's outline and curves the rectangle on the left edges.
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRoundRectLeftSide = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: 0, br: 0, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.fill();
    }
};


/**
 * Fills a rectangular shape's outline and curves the rectangle on the right edges.
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRoundRectRightSide = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: 0, tr: radius, br: radius, bl: 0 };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.fill();
    }
};


/**
 * Fills a rectangular shape's outline and curves the rectangle on the top edges.
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRoundRectTopSide = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: 0, bl: 0 };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.fill();
    }
};


/**
 * Fills a rectangular shape's outline and curves the rectangle on the bottom edges.
 * @param {number} x The left coordinates of the rectangle
 * @param {number} y The right top coordinates of the rectangle
 * @param {number} width The width of the rectangle
 * @param {number} height The height of the rectangle
 * @param {number} radius The radius of the rectangle
 * @returns {undefined}
 */
Graphics.prototype.fillRoundRectBottomSide = function (x, y, width, height, radius) {
    if (typeof x === 'number' && typeof y === 'number' && typeof width === 'number' && typeof height === 'number' && typeof radius === 'number') {

        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: 0, tr: 0, br: radius, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        this.ctx.fill();
    }
};
/**
 * Draws an ellipse
 * @param {Number} cenX The x-center of the ellipse
 * @param {Number} cenY The y-center of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @param {Number} rotation The rotation of the ellipse, expressed in radians.
 * @param {Number} startAngle The angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
 * @param {Number} endAngle The angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
 * @param {boolean} counterclockwise An optional Boolean which, if true, draws the ellipse counterclockwise (anticlockwise). The default value is false (clockwise).
 * @returns {undefined}
 */
Graphics.prototype.drawEllipse = function (cenX, cenY, radX, radY, rotation, startAngle, endAngle, counterclockwise) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radX === 'number' && typeof radY === 'number' &&
        typeof rotation === 'number' && typeof startAngle === 'number' && typeof endAngle === 'number' && typeof counterclockwise === 'boolean') {

        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, rotation, startAngle, endAngle, counterclockwise);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};

/**
 * Fills an ellipse
 * @param {Number} cenX The x-center of the ellipse
 * @param {Number} cenY The y-center of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @param {Number} rotation The rotation of the ellipse, expressed in radians.
 * @param {Number} startAngle The angle at which the ellipse starts, measured clockwise from the positive x-axis and expressed in radians.
 * @param {Number} endAngle The angle at which the ellipse ends, measured clockwise from the positive x-axis and expressed in radians.
 * @param {boolean} counterclockwise An optional Boolean which, if true, draws the ellipse counterclockwise (anticlockwise). The default value is false (clockwise).
 * @returns {undefined}
 */
Graphics.prototype.fillEllipse = function (cenX, cenY, radX, radY, rotation, startAngle, endAngle, counterclockwise) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radX === 'number' && typeof radY === 'number' &&
        typeof rotation === 'number' && typeof startAngle === 'number' && typeof endAngle === 'number' && typeof counterclockwise === 'boolean') {

        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, rotation, startAngle, endAngle, counterclockwise);
        this.ctx.fill();
    }
};


/**
 * Same as drawEllipse, but with less options
 * @param {Number} cenX The x-center of the ellipse
 * @param {Number} cenY The y-center of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @returns {undefined}
 */
Graphics.prototype.drawOval = function (cenX, cenY, radX, radY) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radX === 'number' && typeof radY === 'number') {

        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, 0, 0, 2 * Math.PI, false);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};
/**
 * Same as drawEllipse, but with less options
 * @param {Number} left The left of the ellipse
 * @param {Number} top The top of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @returns {undefined}
 */
Graphics.prototype.drawOvalFromTopLeft = function (left, top, radX, radY) {
    if (typeof left === 'number' && typeof top === 'number' && typeof radX === 'number' && typeof radY === 'number') {

        let cenX = left + radX;
        let cenY = top + radY;
        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, 0, 0, 2 * Math.PI, false);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};

/**
 * Same as fillEllipse, but with less options
 * @param {Number} cenX The x-center of the ellipse
 * @param {Number} cenY The y-center of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @returns {undefined}
 */
Graphics.prototype.fillOval = function (cenX, cenY, radX, radY) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radX === 'number' && typeof radY === 'number') {

        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, 0, 0, 2 * Math.PI, false);
        this.ctx.fill();

    }
};


/**
 * Same as fillEllipse, but with less options
 * @param {Number} left The left side of the ellipse
 * @param {Number} top The top of the ellipse
 * @param {Number} radX The ellipse's major-axis radius. Must be non-negative.
 * @param {Number} radY The ellipse's minor-axis radius. Must be non-negative.
 * @returns {undefined}
 */
Graphics.prototype.fillOvalFromTopLeft = function (left, top, radX, radY) {
    if (typeof left === 'number' && typeof top === 'number' && typeof radX === 'number' && typeof radY === 'number') {

        let cenX = left + radX;
        let cenY = top + radY;

        this.ctx.beginPath();
        this.ctx.ellipse(cenX, cenY, radX, radY, 0, 0, 2 * Math.PI, false);
        this.ctx.fill();

    }
};

/**
 * Draws a circle
 * @param {Number} cenX The x center  of the circle
 * @param {Number} cenY The y center  of the circle
 * @param {Number} radius The radius of the circle
 * @returns {undefined}
 */
Graphics.prototype.drawCircle = function (cenX, cenY, radius) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radius === 'number') {
        this.drawOval(cenX, cenY, radius, radius);
    }
};


/**
 * Draws a circle
 * @param {Number} left The left  of the circle
 * @param {Number} top The  top  of the circle
 * @param {Number} radius The radius of the circle
 * @returns {undefined}
 */
Graphics.prototype.drawCircleFromTopLeft = function (left, top, radius) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radius === 'number') {
        this.drawOvalFromTopLeft(left, top, radius, radius);
    }
};

/**
 * Fills a circle
 * @param {Number} cenX The x center  of the circle
 * @param {Number} cenY The y center  of the circle
 * @param {Number} radius The radius of the circle
 * @returns {undefined}
 */
Graphics.prototype.fillCircle = function (cenX, cenY, radius) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radius === 'number') {
        this.fillOval(cenX, cenY, radius, radius);
    }
};

/**
 * Fills a circle
 * @param {Number} left The left of the circle
 * @param {Number} top The top  of the circle
 * @param {Number} radius The radius of the circle
 * @returns {undefined}
 */
Graphics.prototype.fillCircleFromTopLeft = function (left, top, radius) {
    if (typeof left === 'number' && typeof top === 'number' && typeof radius === 'number') {
        this.fillOvalFromTopLeft(left, top, radius, radius);
    }
};

Graphics.prototype.drawArc = function (cenX, cenY, radius, startAngle, endAngle, counterclockwise) {
    if (typeof cenX === 'number' && typeof cenY === 'number' && typeof radius === 'number' &&
        typeof startAngle === 'number' && typeof endAngle === 'number' && typeof counterclockwise === 'boolean') {

        this.ctx.beginPath();
        this.ctx.arc(cenX, cenY, radius, startAngle, endAngle, counterclockwise);
        this.ctx.stroke();
    }
};

/**
 *
 * @param left The left side of the enclosing rectangle
 * @param top The top side of the enclosing rectangle
 * @param radius The radius of the arc
 * @param startAngle The starting angle of the arc
 * @param endAngle The ending angle of the arc
 * @param counterclockwise If true, draw the arc in a counter-clockwise direction.
 */
Graphics.prototype.drawArcFromTopLeft = function (left, top, radius, startAngle, endAngle, counterclockwise) {
    if (typeof left === 'number' && typeof top === 'number' && typeof radius === 'number' &&
        typeof startAngle === 'number' && typeof endAngle === 'number' && typeof counterclockwise === 'boolean') {
        let cenX = left + radius;
        let cenY = top + radius;

        this.ctx.beginPath();
        this.ctx.arc(cenX, cenY, radius, startAngle, endAngle, counterclockwise);
        this.ctx.stroke();
    }
};


/**
 * Draws a line between the 2 points
 * @param {Number} x1 The x coordinate of the first point
 * @param {Number} y1 The y coordinate of the first point
 * @param {Number} x2 The x coordinate of the second point
 * @param {Number} y2 The x coordinate of the seond point
 * @returns {undefined}
 */
Graphics.prototype.drawLine = function (x1, y1, x2, y2) {
    if (typeof x1 === 'number' && typeof y1 === 'number' && typeof x2 === 'number' && typeof y2 === 'number') {
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
    }
};

/**
 * Draw a polygon
 * @param {Polygon} polygon
 * @returns {undefined}
 */
Graphics.prototype.drawPolygon = function (polygon) {
    if (polygon.constructor.name === 'Polygon') {

        var x = 0;
        var y = 0;
        this.ctx.beginPath();
        for (var i = 0; i < polygon.xpoints.length; i++) {
            x = polygon.xpoints[i];
            y = polygon.ypoints[i];
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.lineTo(x, y);
        this.ctx.closePath();
        this.ctx.stroke();
    }
};


/**
 * Fills a polygon
 * @param {Polygon} polygon
 * @returns {undefined}
 */
Graphics.prototype.fillPolygon = function (polygon) {
    if (polygon && polygon.constructor.name === 'Polygon') {
        let x = 0;
        let y = 0;
        this.ctx.beginPath();
        for (let i = 0; i < polygon.xpoints.length; i++) {
            x = polygon.xpoints[i];
            y = polygon.ypoints[i];
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.lineTo(x, y);
        this.ctx.closePath();
        this.ctx.fill();
    }
};


/**
 * Draws a polygon given its vertices and its vertex count
 * @param {[]} xpoints An array of x coordinates in the polygon
 * @param {[]} ypoints An array of y coordinates in the polygon
 * @param {number} npoints The number of items in x and y: must be same
 * @returns {undefined}
 */
Graphics.prototype.drawPolygonFromVertices = function (xpoints, ypoints, npoints) {
    if (Object.prototype.toString.call(xpoints) !== '[object Array]') {
        logger('xpoints must be an array of integer numbers');
        return;
    }
    if (Object.prototype.toString.call(ypoints) !== '[object Array]') {
        logger('ypoints must be an array of integer numbers');
        return;
    }
    if (typeof npoints !== 'number') {
        logger('npoints must be an integer number');
        return;
    }
    if (xpoints.length !== ypoints.length) {
        logger('xpoints and ypoints must have the same size.');
        return;
    }
    var x = 0;
    var y = 0;
    this.ctx.beginPath();
    for (var i = 0; i < xpoints.length; i++) {
        var x = xpoints[i];
        var y = ypoints[i];
        if (i === 0) {
            this.ctx.moveTo(x, y);
        } else {
            this.ctx.lineTo(x, y);
        }
    }
    this.ctx.lineTo(x, y);
    this.ctx.closePath();
    this.ctx.stroke();

};


/**
 * Fills a polygon given its vertices and its vertex count
 * @param {[]} xpoints An array of x coordinates in the polygon
 * @param {[]} ypoints An array of y coordinates in the polygon
 * @param {number} npoints The number of items in x and y: must be same
 * @returns {undefined}
 */
Graphics.prototype.fillPolygonFromVertices = function (xpoints, ypoints, npoints) {
    if (Object.prototype.toString.call(xpoints) !== '[object Array]') {
        logger('xpoints must be an array of integer numbers');
        return;
    }
    if (Object.prototype.toString.call(ypoints) !== '[object Array]') {
        logger('ypoints must be an array of integer numbers');
        return;
    }
    if (typeof npoints !== 'number') {
        logger('npoints must be an integer number');
        return;
    }
    if (xpoints.length !== ypoints.length) {
        logger('xpoints and ypoints must have the same size.');
        return;
    }
    var x = 0;
    var y = 0;
    this.ctx.beginPath();
    for (var i = 0; i < xpoints.length; i++) {
        var x = xpoints[i];
        var y = ypoints[i];
        if (i === 0) {
            this.ctx.moveTo(x, y);
        } else {
            this.ctx.lineTo(x, y);
        }
    }
    this.ctx.lineTo(x, y);
    this.ctx.closePath();
    this.fill();

};


/**
 * Fills a polygon
 * @returns {undefined}
 */
Graphics.prototype.save = function () {
    this.ctx.save();
};

/**
 *
 * @param canvas The canvas
 * @param mimeType the mimetype e.g image/png or image/jpeg
 * @param callbackFn A function to run with the arraybuffer as parameter
 */
Graphics.prototype.getBlobFromCanvas = function (canvas, mimeType, callbackFn) {
    canvas.toBlob(function (blob) {
        callbackFn(blob);
    }, mimeType);
};


/**
 * When some pixels have been drawn on the underlying canvas, use this method
 * to obtain the maximum width that the content drawn occupies.
 *
 * The full details of the extent, both horizontal and vertical are returned by the
 * Graphics.getBoundingBox method. Sometimes you just need the horizontal bounds, so use this.
 * If you need just the vertical bounds, then use the Graphics.getVerticalExtent method
 *
 * @returns {Rectangle}
 */
Graphics.prototype.getHorizontalExtent = function () {

    let ret = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

    // Get the pixel data from the canvas
    let data = this.getImageData(0, 0, this.width, this.height).data;


    let right = false;
    let left = false;
    let width = this.width;
    let height = this.height;

    let r = height;
    let c = width;


    // 3. get right
    c = width;
    while (!right && c) {
        c--;
        for (r = 0; r < height; r++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                right = c + 1;
                ret.right = c + 1;
                break;
            }
        }
    }

    // 4. get left
    c = 0;
    while (!left && c < right) {

        for (r = 0; r < height; r++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                left = c;
                ret.left = c;
                ret.width = right - left - 1;
                break;
            }
        }
        c++;

        // If we've got it then return the extent
        if (left) {
            return { left: ret.left, right: ret.right };
        }
    }

    // A mess-up occurred ...
    return null;
};


/**
 * When some pixels have been drawn on the underlying canvas, use this method
 * to obtain the maximum height that the content drawn occupies.
 *
 * The full details of the extent, both horizontal and vertical are returned by the
 * Graphics.getBoundingBox method. Sometimes you just need the horizontal bounds, so use this.
 * If you need just the vertical bounds, then use the Graphics.getVerticalExtent method
 *
 * @returns {Rectangle}
 */
Graphics.prototype.getVerticalExtent = function () {

    let ret = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

    // Get the pixel data from the canvas
    let data = this.getImageData(0, 0, this.width, this.height).data;

    let first = false;
    let last = false;
    let width = this.width;
    let height = this.height;

    let r = height;
    let c = 0;

    // 1. get bottom
    while (!last && r) {
        r--;
        for (c = 0; c < width; c++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                last = r + 1;
                ret.bottom = r + 1;
                break;
            }
        }
    }

    // 2. get top
    r = 0;
    while (!first && r < last) {

        for (c = 0; c < width; c++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                first = r - 1;
                ret.top = r - 1;
                ret.height = last - first - 1;
                break;
            }
        }
        r++;

        // If we've got it then return the height
        if (first) {
            return { top: ret.top, bottom: ret.bottom };
        }
    }

    // A mess-up occurred ...
    return null;
};


/**
 * When some pixels have been drawn on the underlying canvas, use this method
 * to obtain a Rectangle that fits about the content drawn.
 * You may now use this to crop the drawing area.
 * @returns {Rectangle}
 */
Graphics.prototype.getBoundingBox = function () {

    let ret = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

    // Get the pixel data from the canvas
    let data = this.getImageData(0, 0, this.width, this.height).data;

    let first = false;
    let last = false;
    let right = false;
    let left = false;
    let width = this.width;
    let height = this.height;

    let r = height;
    let c = 0;

    // 1. get bottom
    while (!last && r) {
        r--;
        for (c = 0; c < width; c++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                last = r + 1;
                ret.bottom = r + 1;
                break;
            }
        }
    }

    // 2. get top
    r = 0;
    while (!first && r < last) {

        for (c = 0; c < width; c++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                first = r - 1;
                ret.top = r - 1;
                ret.height = last - first - 1;
                break;
            }
        }
        r++;
    }

    // 3. get right
    c = width;
    while (!right && c) {
        c--;
        for (r = 0; r < height; r++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                right = c + 1;
                ret.right = c + 1;
                break;
            }
        }
    }

    // 4. get left
    c = 0;
    while (!left && c < right) {

        for (r = 0; r < height; r++) {
            if (data[r * width * 4 + c * 4 + 3]) {
                left = c;
                ret.left = c;
                ret.width = right - left - 1;
                break;
            }
        }
        c++;

        // If we've got it then return the height
        if (left) {
            return new Rectangle(ret.left, ret.top, ret.right, ret.bottom);
        }
    }

    // console.log('lol!!...' + JSON.stringify(ret));
    // A mess-up occurred ...
    return null;
};

/**
 *
 * @param {number} padding The padding in pixels to apply to the bounding box. Set to zero to make the image
 * fit as perfectly as possible.
 * @param {Function} callbackFn A function to call once the fitted png is ready. It is supplied as a blob to this callback
 * @returns {undefined}
 */
Graphics.prototype.getFittedPNG = function (padding, callbackFn) {

    if (callbackFn) {
        if (typeof callbackFn !== 'function') {
            throw new Error('If you are supplying a callback, then it has to be a function!');
        }
        if (callbackFn.length !== 1) {
            throw new Error('Your callback function should have only 1 parameter, this is a blob that contains the fitted PNG image');
        }
    }
    padding = this.normalizeQuantity(padding);
    let rect = this.getBoundingBox();
    let minX = rect.left;
    let minY = rect.top;
    let maxX = rect.right;
    let maxY = rect.bottom;
    let cv = document.createElement('canvas');
    cv.width = maxX - minX;
    cv.height = maxY - minY;


    // Apply a padding
    cv.width += 2 * padding;
    cv.height += 2 * padding;


    cv.getContext('2d').drawImage(this.getCanvas(), minX - padding, minY - padding, cv.width, cv.height, 0, 0, cv.width, cv.height);
    return this.getBlobFromCanvas(cv, 'image/png', callbackFn);
};


/**
 *
 * @param {type} text The text to draw
 * @param {type} x The x coordinate of the text's location
 * @param {type} y The y coordinate of the text's location
 * @returns {undefined}
 */
Graphics.prototype.drawHollowString = function (text, x, y) {
    this.ctx.strokeText(text, x, y);
};
/**
 *
 * @param {String} text The text to draw
 * @param {Number} x The x coordinate of the text's location
 * @param {Number} y The y coordinate of the text's location
 * @returns {undefined}
 */
Graphics.prototype.drawString = function (text, x, y) {
    this.ctx.fillText(text, x, y);
};

Graphics.prototype.drawImageAt = function (image, dx, dy) {
    if (typeof dx === 'number' && typeof dy === 'number') {
        this.ctx.drawImage(image, dx, dy);
    }

};

Graphics.prototype.drawImageAtLocWithSize = function (image, dx, dy, dWidth, dHeight) {
    if (typeof dx === 'number' && typeof dy === 'number' && typeof dWidth === 'number' && typeof dHeight === 'number') {
        this.ctx.drawImage(image, dx, dy, dWidth, dHeight);
    }

};

/**
 *
 * @param image An element to draw into the context.
 * The specification permits any canvas image source ( CanvasImageSource ),
 * specifically, a CSSImageValue , an HTMLImageElement , an SVGImageElement ,
 * an HTMLVideoElement , an HTMLCanvasElement , an ImageBitmap , or an OffscreenCanvas .
 * @param sx The x-axis coordinate of the top left corner of the sub-rectangle of the source image to
 * draw into the destination context. Note that this argument is not included in the 3- or 5-argument syntax.
 * @param sy The y-axis coordinate of the top left corner of the sub-rectangle of the source image to draw
 * into the destination context. Note that this argument is not included in the 3- or 5-argument syntax.
 * @param sWidth The width of the sub-rectangle of the source image to draw into the destination context.
 * If not specified, the entire rectangle from the coordinates specified by sx and sy to the bottom-right corner of the image is used. Note that this argument is not included in the 3- or 5-argument syntax.
 * @param sHeight The height of the sub-rectangle of the source image to draw into the destination context.
 * Note that this argument is not included in the 3- or 5-argument syntax.
 * @param dx The x-axis coordinate in the destination canvas at which to place the top-left corner of the source image .
 * @param dy The y-axis coordinate in the destination canvas at which to place the top-left corner of the source image .
 * @param dWidth The width to draw the image in the destination canvas. This allows scaling of the drawn image.
 * If not specified, the image is not scaled in width when drawn. Note that this argument is not included in the
 * 3-argument syntax.
 * @param dHeight The height to draw the image in the destination canvas. This allows scaling of the drawn image.
 * If not specified, the image is not scaled in height when drawn. Note that this argument is not included in the
 * 3-argument syntax
 */
Graphics.prototype.drawImage = function (image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
    if (typeof sx === 'number' && typeof sy === 'number' && typeof sWidth === 'number' && typeof sHeight === 'number'
        && typeof dx === 'number' && typeof dy === 'number' && typeof dWidth === 'number' && typeof dHeight === 'number') {
        this.ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
    }

};




/**
 * 
 * To increase performance, where possible, createImageData method 
 * should be executed once e.g. before drawing
 * @param {number} width The width to give the new ImageData object. A negative value flips the rectangle around the vertical axis.
 * @param {number} height The height to give the new ImageData object. A negative value flips the rectangle around the horizontal axis.
 * @returns A new ImageData object with the specified width and height. The new object is filled with transparent black pixels.
 */
Graphics.prototype.createImageData = function (width, height) {
    if (typeof width === "number" && typeof height === "number") {
        return this.ctx.createImageData(width, height);
    } else {
        if (arguments.length === 1) {
            return this.ctx.createImageData(width);
        }
    }
};
/**
 *
 * @param {Number} x The x location
 * @param {Number} y The y location
 * @param {Number} width The width of the area to copy
 * @param {Number} height The height of the area to copy
 * @returns {ImageData}
 */
Graphics.prototype.getImageData = function (x, y, width, height) {
    if (typeof x === "number" && typeof y === "number" && typeof width === "number" && typeof height === "number") {
        return this.ctx.getImageData(x, y, width, height);
    }
};
/**
 * An ImageData object containing the array of pixel values.
 * 
 * @param { ImageData } imageData An ImageData object containing the array of pixel values.
 * @param { number } x Horizontal position (x coordinate) at which to place the image data in the destination canvas.
 * @param { number } y Vertical position (y coordinate) at which to place the image data in the destination canvas.
 * @param { number } dirtyX Optional Horizontal position (x coordinate) of the top-left corner from which the image data will be extracted. Defaults to 0.
 * @param { number } dirtyY Optional Vertical position (y coordinate) of the top-left corner from which the image data will be extracted. Defaults to 0.
 * @param { number } dirtyWidth Optional Width of the rectangle to be painted. Defaults to the width of the image data.
 * @param { number } dirtyHeight Optional Height of the rectangle to be painted. Defaults to the height of the image data.
 * @returns 
 */
Graphics.prototype.putImageData = function (imageData, x, y, dirtyX, dirtyY, dirtyWidth, dirtyHeight) {
    if (typeof x === "number" && typeof y === "number") {
        return this.ctx.putImageData(imageData, x, y, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    }
};

/**
 * @param {number} x The horizontal coordinates where are drawing the pixel
 * @param {number} y The vertical coordinates where we are drawing the pixel
 * @param {number} r Optional The red component of the color (0-255)
 * @param {number} g Optional The green component of the color (0-255)
 * @param {number} b Optional The blue component of the color (0-255)
 * @param {number} a Optional The alpha component of the color (0-255)
 */
Graphics.prototype.drawPixel = function (x, y, r, g, b, a) {
    if (typeof x === 'number' && typeof y === 'number') {
        r = (typeof r === "number" && r >= 0 && r < 256) ? r : 0;
        g = (typeof g === "number" && g >= 0 && g < 256) ? g : 0;
        b = (typeof b === "number" && b >= 0 && b < 256) ? b : 0;
        a = (typeof a === "number" && a >= 0 && a < 256) ? a : 255;

        let data = this.imageCacheUnitPx.data;
        data[0] = r;
        data[1] = g;
        data[2] = b;
        data[3] = a;
        this.ctx.putImageData(this.imageCacheUnitPx, x, y);
    }
};

/**
 * @param {number} x The horizontal coordinates where are drawing the pixel
 * @param {number} y The vertical coordinates where we are drawing the pixel
 * @param {number} r Optional The red component of the color (0-255)
 * @param {number} g Optional The green component of the color (0-255)
 * @param {number} b Optional The blue component of the color (0-255)
 * @param {number} a Optional The alpha component of the color (0-255)
 */
Graphics.prototype.drawDoublePixel = function (x, y, r, g, b, a) {
    if (typeof x === 'number' && typeof y === 'number') {

        r = (typeof r === "number" && r >= 0 && r < 256) ? r : 0;
        g = (typeof g === "number" && g >= 0 && g < 256) ? g : 0;
        b = (typeof b === "number" && b >= 0 && b < 256) ? b : 0;
        a = (typeof a === "number" && a >= 0 && a < 256) ? a : 255;

        let data = this.imageCacheQuadPx.data;
        data[0] = r;
        data[1] = g;
        data[2] = b;
        data[3] = a;

        data[4] = r;
        data[5] = g;
        data[6] = b;
        data[7] = a;

        data[8] = r;
        data[9] = g;
        data[10] = b;
        data[11] = a;

        data[12] = r;
        data[13] = g;
        data[14] = b;
        data[15] = a;

        this.ctx.putImageData(this.imageCacheQuadPx, x, y);
    }
};

/**
 *
 * @param {string} text Text whose width is needed
 * @returns {number}
 */
Graphics.prototype.stringWidth = function (text) {
    if (typeof text === 'string') {
        return this.ctx.measureText(text).width;
    }
    return 0;
};


/**
 *
 * @param {string} text Text whose width is needed
 * @returns {number}
 */
Graphics.prototype.getTextWidth = function (text) {
    if (typeof text === 'string') {
        if (text.length === 0) {
            return 0;
        }
        let cv = document.createElement('canvas');

        cv.width = this.width;
        cv.height = this.height;
        cv.style.width = this.width + 'px';
        cv.style.height = this.height + 'px';
        document.body.appendChild(cv);

        let gg = new Graphics(cv);

        gg.ctx.font = this.ctx.font;

        gg.setBackground('#000');
        gg.drawString(text, 10, cv.height / 2);

        let bounds = gg.getHorizontalExtent();
        cv.remove();
        gg.clear();
        gg.destroy();
        gg = null;
        if (bounds) {
            return bounds.right - bounds.left;
        }
    }

    return null;
};


/**
 *
 * @param {string} text Text whose width is needed
 * @returns {number}
 */
Graphics.prototype.getTextHeight = function (text) {
    if (typeof text === 'string') {
        if (text.length === 0) {
            return 0;
        }
        let cv = document.createElement('canvas');

        cv.width = this.width;
        cv.height = this.height;
        cv.style.width = this.width + 'px';
        cv.style.height = this.height + 'px';
        document.body.appendChild(cv);

        let gg = new Graphics(cv);

        gg.ctx.font = this.ctx.font;

        gg.setBackground('#000');
        gg.drawString(text, 10, cv.height / 2);

        let bounds = gg.getVerticalExtent();
        cv.remove();
        gg.clear();
        gg.destroy();
        gg = null;
        if (bounds) {
            return bounds.bottom - bounds.top;
        }
    }

    return null;
};

/**
 *
 * @param {string} text Text whose size is needed
 * @returns {number}
 */
Graphics.prototype.getTextSize = function (text) {
    if (typeof text === 'string') {
        if (text.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }
        let cv = document.createElement('canvas');

        cv.width = this.width;
        cv.height = this.height;
        cv.style.width = this.width + 'px';
        cv.style.height = this.height + 'px';
        document.body.appendChild(cv);

        let gg = new Graphics(cv);
        gg.ctx.font = this.ctx.font;

        gg.setBackground('#000');
        gg.drawString(text, 10, cv.height / 2);

        let rect = gg.getBoundingBox();
        cv.remove();
        gg.clear();
        gg.destroy();
        gg = null;
        return rect;
    }

    return null;
};


/**
 * Computes the size of an arra of strings using same canvas to optimize dom editing.
 * @param {string} textArray An array of strings whose dimensions are needed
 * @returns {Array} An array of rectangles containing the width and height of the strings in the specified order
 */
Graphics.prototype.getTextSizes = function (textArray) {
    if (isOneDimArray(textArray)) {
        if (textArray.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }
        let cv = document.createElement('canvas');

        cv.width = this.width;
        cv.height = this.height;
        cv.style.width = this.width + 'px';
        cv.style.height = this.height + 'px';
        document.body.appendChild(cv);

        let gg = new Graphics(cv);
        gg.ctx.font = this.ctx.font;

        gg.setBackground('#000');

        let rectArray = [];

        for (let i = 0; i < textArray.length; i++) {
            gg.drawString(textArray[i], 10, cv.height / 2);
            let rect = gg.getBoundingBox();
            gg.clear();
            rectArray.push(rect);
        }


        cv.remove();
        gg.destroy();
        gg = null;
        return rect;
    }

    return null;
};

/**
 *
 * @param {String} text A number between 0 and 1
 * @returns {number}
 */
Graphics.prototype.textHeight = function (text) {
    if (typeof text === 'string') {
        return this.ctx.measureText('M').width;
    }
    return 0;
};


/**
 * Stores a line of text and its pixel width
 * @param {string} txtline
 * @param {Number} width
 * @returns {LineAndWidth}
 */
function LineAndWidth(txtline, width) {
    if (typeof txtline !== 'string' || typeof width !== 'number') {
        this.text = "";
        this.width = 0;
        return;
    }

    this.text = txtline;
    this.width = width;
}

/**
 * Does the same thing as the <code>getLinesByMaxWidthAlgorithm</code> method, but provides finer detail by
 * wrapping text to the next line even if it is in the middle of a word.
 * If this behaviour is undesirable, please use the <code>getLinesByMaxWidthAlgorithm</code> method; as that method
 * is word sensitive.
 * @param {string} txt A text to be scanned into lines based on a specified width of available space.
 * @param {Number} availableWidth The width available for drawing text.
 * @returns {Array|scanLines.lines}
 */
Graphics.prototype.scanLines = function (txt, availableWidth) {
    let lines = [];
    let ctx = this.ctx;

    let token = new StringBuffer();
    for (var i = 0; i < txt.length; i++) {

        if (ctx.measureText(token.toString()).width < availableWidth) {
            token.append(txt.substring(i, i + 1));
        } else {
            let tx = token.toString();
            let line = {
                width: ctx.measureText(tx).width,
                text: tx
            };

            lines.push(line);
            token = new StringBuffer();
            token.append(txt.substring(i, i + 1));
        }
    }
    if (token.toString().length > 0) {
        let tx = token.toString();
        let line = {
            width: ctx.measureText(tx).width,
            text: tx
        };
        lines.push(line);
    }
    return lines;
};

/**
 * @param {string} text The text to split into lines of text.
 * @param {Number} lineWidth The maximum width of the line.
 * The splitting algorithm ensures that no line of text is ever longer pixel-wise than the specified line-width
 * @return the text divided into lines.
 */
Graphics.prototype.getLinesByMaxWidthAlgorithm = function (text, lineWidth) {
    let lines = [];
    let ctx = this.ctx;

    let cs = new Scanner(text, true, ["\r\n", "\t", "\r", " ", "\n"]);
    let list = cs.scan();
    let sz = list.length;

    let line = new StringBuffer();
    let oldWidth = 0;
    for (let i = 0; i < sz; i++) {
        let entry = list[i];
        let wid = ctx.measureText(line.toString() + entry).width;
        if (wid < lineWidth) {
            line.append(entry);
        } else if (wid === lineWidth || entry === "\r\n" || entry === "\r" || entry === "\n") {
            line.append(entry);
            lines.push(new LineAndWidth(line.toString(), wid));
            line = new StringBuffer();
        } else if (wid > lineWidth) {
            lines.push(new LineAndWidth(line.toString(), oldWidth));
            line = new StringBuffer();
            line.append(entry);
        }
        oldWidth = wid;
    }//end for loop
    let ln = line.toString();
    if (ln.length > 0) {
        lines.push(new LineAndWidth(ln, oldWidth));
    }


    return lines;
};//end method
//MysteryImages

const MysteryConstants = {
    DRAW_SQUARE: 1,
    DRAW_RECT: 2,
    DRAW_CIRCLE: 3,
    DRAW_OVAL: 4,
    DRAW_DOT: 5,
    DRAW_DOT2: 6,
    DRAW_LINE: 7,
    DRAW_STAR: 8,
    DRAW_LETTER: 9,
    DRAW_TRIANGLE: 10,
    DRAW_TEXT: 11,
    DRAW_ROTATED_SQUARE: 12,
    DRAW_ROTATED_RECT: 13,
    DRAW_ROTATED_TRIANGLE: 14,
    DRAW_ROTATED_STAR: 15,
    DRAW_ROTATED_OVAL: 16,
    DRAW_POLYGON: 17,
    DRAW_ROTATED_TEXT: 18,
    DENSITY_SCALE: 0.00001,
    DEF_ALPHA: 1
};

const MysteryModes = {
    ALL: "all",
    STAR: "star",
    LINE: "line",
    DOT: "dot",
    DOT2: "dot2",
    TEXT: "text",
    TRIANGLE: "triangle",
    SQUARE: "square",
    OVAL: "oval",
    CIRCLE: "circle",
    POLYGON: "polygon",
    COMBO: "combo"
};

/**
 *
 * @param options The options used to create this MysteryImage
 *
 *
 let options = {
 width: 200px,
 height:450px,
 fontName: "Arial',
 fontSize: "12px",
 fontStyle: italic bold|regular|...,
 fgColor: ,
 bgColor: ,
 numShapes: 50, // Total number of shapes to generate
 shapesDensity: 10, //Total number of shapes per unit area
 strokeWidth: 1,
 minSize: 30, //The minimum size of the shapes drawn
 opacity: MysteryConstants.DEF_ALPHA,
 bgOpacityEnabled: false,
 textArray: [], //An array of words that can be rendered randomly on the view.
 textOnly: false,//Forces the view to render only text from the textArray attribute
 cacheAfterDraw: true, //Renders the image once for a view and uses it subsequently.If false, this view will always have a new set of patterns whenever it is refreshed.
 }

 Remember to call the cleanup instance method to dispose f the resources used after getting your image.
 This is important if you wish to get just one image from this class.
 * @constructor
 */
function MysteryImage(options) {
    if (!options) {
        throw 'No initializing options specified!';
    }
    this.rnd = new Random();
    this.mode = MysteryModes.ALL;
    this.comboArray = [];
    this.state = MysteryConstants.DRAW_ROTATED_TEXT;


    this.id = "mystery_" + this.rnd.generateUUID();
    this.width = 100;
    if (options.width) {
        if (typeof options.width === "number") {
            this.width = options.width;
        } else if (typeof options.width === "string") {
            try {
                this.width = parseInt(options.width);
            } catch (e) {
                throw e;
            }
        } else {
            throw 'Invalid value specified for `width`';
        }
    }
    this.height = 100;
    if (options.height) {
        if (typeof options.height === "number") {
            this.height = options.height;
        } else if (typeof options.height === "string") {
            try {
                this.height = parseInt(options.height);
            } catch (e) {
                throw e;
            }
        } else {
            throw 'Invalid value specified for `height`';
        }
    }

    if (options.mode) {
        if (typeof options.mode === "string") {
            let self = this;
            if (options.mode.indexOf(",") === -1) {
                let found = false;
                Object.keys(MysteryModes).forEach(function (key) {
                    if (options.mode === key.toLowerCase()) {
                        self.mode = key;
                        found = true;
                    }
                });
                if (!found) {
                    throw 'invalid mi-mode: `' + options.mode + '`';
                }
            } else {
                let detectedStates = options.mode.replace(/\s/g, "").split(",");
                for (let i = 0; i < detectedStates.length; i++) {
                    let found = false;
                    let st = detectedStates[i];
                    Object.keys(MysteryModes).forEach(function (key) {
                        if (st === key.toLowerCase()) {
                            self.comboArray.push(key);
                            found = true;
                        }
                    });
                    if (!found) {
                        throw 'invalid mi-mode: `' + options.mode + '`';
                    }
                }
                this.mode = MysteryModes.COMBO;
            }
        } else {
            throw 'Invalid value specified for `mode`';
        }
    }


    let canvas = makeCanvas(this.id, this.width, this.height);
    this.numShapes = 20;
    if (options.numShapes) {
        if (typeof options.numShapes === "number") {
            this.numShapes = options.numShapes;
        } else if (typeof options.numShapes === "string") {
            try {
                this.numShapes = parseInt(options.numShapes);
            } catch (e) {
                throw e;
            }
        } else {
            throw 'Invalid value specified for `numShapes`';
        }
    }
    this.fontName = "Segoe UI";
    if (options.fontName) {
        if (typeof options.fontName === 'string') {
            this.fontName = options.fontName;
        } else {
            throw "Bad value specified for `fontName`";
        }
    }
    this.strokeWidth = 1;
    if (options.strokeWidth) {
        if (typeof options.strokeWidth === "number") {
            this.strokeWidth = options.strokeWidth;
        } else if (typeof options.strokeWidth === "string") {
            try {
                this.strokeWidth = parseInt(options.strokeWidth);
            } catch (e) {
                throw e;
            }

        } else {
            throw 'Invalid value specified for `strokeWidth`';
        }
    }
    this.fontSize = 12;
    if (options.fontSize) {
        if (typeof options.fontSize === 'number') {
            this.fontSize = options.fontSize;
        } else if (typeof options.fontSize === 'string') {
            this.fontSize = parseInt(options.fontSize);
        } else {
            throw 'Invalid value specified for `fontSize`';
        }
    }

    this.fontStyle = FontStyle.REGULAR;
    if (options.fontStyle) {
        if (typeof options.fontStyle === 'string') {
            if (FontStyleValues.indexOf(options.fontStyle) === -1) {
                throw "Invalid value specified for font size";
            }
            this.fontStyle = options.fontStyle;
        } else {
            throw 'Invalid value specified for `fontStyle`';
        }
    }

    this.sizeUnits = CssSizeUnits.PX;
    if (options.sizeUnits) {
        if (typeof options.sizeUnits === 'string') {
            if (CssSizeUnitsValues.indexOf(options.sizeUnits) === -1) {
                throw "Invalid size unit specified for font size";
            }
            this.sizeUnits = options.sizeUnits;
        } else {
            this.sizeUnits = CssSizeUnits.PX;
        }
    }
    this.minSize = 12;
    if (options.minSize) {
        if (typeof options.minSize === "number") {
            this.minSize = options.minSize;
        } else if (typeof options.minSize === "string") {
            try {
                this.minSize = parseInt(options.minSize);
            } catch (e) {
                throw e;
            }

        } else {
            throw 'Invalid value specified for `minSize`';
        }
    }
    this.shapesDensity = 0;
    if (options.shapesDensity) {
        if (typeof options.shapesDensity === "number") {
            this.shapesDensity = options.shapesDensity;
        } else if (typeof options.shapesDensity === "string") {
            try {
                this.shapesDensity = parseInt(options.shapesDensity);
            } catch (e) {
                throw e;
            }
        } else {
            throw 'Invalid value specified for `shapesDensity`';
        }
    }
    this.opacity = MysteryConstants.DEF_ALPHA;
    if (options.opacity) {
        if (typeof options.opacity === "number") {
            this.opacity = options.opacity;
        } else if (typeof options.opacity === "string") {
            try {
                this.opacity = parseFloat(options.opacity);
            } catch (e) {
                throw e;
            }
        } else {
            throw 'Invalid value specified for `opacity`';
        }
    }

    this.fgColor = '#000';
    if (options.fgColor) {
        if (typeof options.fgColor === 'string') {
            this.fgColor = options.fgColor;
        } else {
            throw 'Invalid value specified for `fgColor`';
        }
    }

    this.bgColor = '#FFF';
    if (options.bgColor) {
        if (typeof options.bgColor === 'string') {
            this.bgColor = options.bgColor;
        } else {
            throw 'Invalid value specified for `bgColor`';
        }
    }

    this.cacheAfterDraw = true;
    if (typeof options.cacheAfterDraw === "boolean") {
        this.cacheAfterDraw = options.cacheAfterDraw;
    }


    this.bgOpacityEnabled = false;
    if (typeof options.bgOpacityEnabled === "boolean") {
        this.bgOpacityEnabled = options.bgOpacityEnabled;
    }

    this.textOnly = false;
    if (options.textOnly) {
        if (typeof options.textOnly === "boolean") {
            this.textOnly = options.textOnly;
        } else {
            throw 'Invalid value specified for `textOnly`';
        }
    }

    this.textArray = [];
    if (options.textArray) {
        if (isOneDimArray(options.textArray)) {
            this.textArray = options.textArray;
        } else {
            throw 'Invalid value specified for `textArray`';
        }
    }

    this.imageCache = null;
    this.g = NewGraphics(this.width, this.height);
    this.font = new Font(this.fontStyle, this.fontSize, this.fontName, this.sizeUnits);
    this.g.setFont(this.font);

    this.g.setStrokeWidth(this.strokeWidth);
    this.g.setBackground(this.bgColor);
    this.g.setColor(this.fgColor);
    this.g.setAlpha(this.opacity);
    this.fgColor = this.g.ctx.strokeStyle;
    this.bgColor = this.g.ctx.fillStyle;


}


function makeCanvas(canvasId, w, h) {
    let canvas = document.createElement('canvas');
    if (canvasId) {
        canvas.id = canvasId;
    }
    canvas.width = w;
    canvas.height = h;
    canvas.style.border = "0px solid";
    document.body.appendChild(canvas);

    return canvas;
}

function invertColor(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    // invert color components
    var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
        g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
        b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
    return '#' + padZero(r) + padZero(g) + padZero(b);
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

/**
 * Free the canvas and release resources
 */
MysteryImage.prototype.cleanup = function () {
    this.imageCache = null;
    this.g.clear();
    this.g.getCanvas().remove();
};
/**
 * Call this only fter calling MysteryImage.prototype.draw()
 * @returns {unresolved}
 */
MysteryImage.prototype.getImage = function () {
    return this.g.getCanvas().toDataURL();
};
/**
 *
 * @param x The horizontal location of the top left of the square
 * @param y The vertical location of the top left of the square
 * @param sz The side length of the square
 * @param fill A boolean. If true, the square will be filled with color. Else it will be drawn plain.
 */
MysteryImage.prototype.drawSquare = function (x, y, sz, fill) {

    let g = this.g;
    if (fill) {
        g.fillRect(x, y, sz, sz);
    } else {
        g.drawRect(x, y, sz, sz);
    }

};

MysteryImage.prototype.drawDot = function (x, y, sz) {
    let g = this.g;
    let hsz = sz / 2;
    let rgbObject = getRGB(this.fgColor);
    let r = rgbObject.r;
    let gr = rgbObject.g;
    let b = rgbObject.b;
    let a = rgbObject.a * 255;

    g.drawPixel(x + hsz, y + hsz, r, gr, b, a);

};
MysteryImage.prototype.drawDoubleDot = function (x, y, sz) {
    let g = this.g;
    let hsz = sz / 2;
    let rgbObject = getRGB(this.fgColor);
    let r = rgbObject.r;
    let gr = rgbObject.g;
    let b = rgbObject.b;
    let a = rgbObject.a * 255;

    g.drawDoublePixel(x + hsz, y + hsz, r, gr, b, a);

};



/**
 *
 * @param x The horizontal location of the top left of the square
 * @param y The vertical location of the top left of the square
 * @param sz The side length of the square
 * @param angDeg
 * @param fill A boolean. If true, the square will be filled with color. Else it will be drawn plain.
 */
MysteryImage.prototype.drawRotatedSquare = function (x, y, sz, angDeg, fill) {
    let g = this.g;
    g.rotateDegsAt(angDeg, x + sz / 2, y + sz / 2, function () {
        if (fill) {
            g.fillRect(-sz / 2, -sz / 2, sz, sz);
        } else {
            g.drawRect(-sz / 2, -sz / 2, sz, sz);
        }
    });
};

MysteryImage.prototype.drawRect = function (x, y, sz, fill) {
    let g = this.g;
    let w = sz;
    let halfSz = sz / 2;
    let h = (halfSz) + this.rnd.nextInt(halfSz + 1);

    w = this.rnd.nextBool() ? h : w;

    let dim = [w, h];

    let ind = this.rnd.nextInt(2);
    w = dim[ind];
    h = ind === 0 ? dim[1] : dim[0];

    if (fill) {
        g.fillRect(x, y, w, h);
    } else {
        g.drawRect(x, y, w, h);
    }

};

MysteryImage.prototype.drawPolygon = function (x, y, sz, fill) {
    let g = this.g;

    let self = this;

    function drawShapeless() {
        let polygon = new Polygon([], [], 0);
        let points = [];
        let sides = 4 + self.rnd.nextInt(5);
        let allowedYs = [y, y + sz / 4, y + 3 * sz / 4, y + sz];
        for (let i = 0; i < sides; i++) {
            let xx = x + self.rnd.nextInt(sz);
            let yy = allowedYs[self.rnd.nextInt(allowedYs.length)];
            points.push(new Point(xx, yy));
        }
        points.sort(function (p1, p2) {
            return p1.x - p2.x;
        });
        for (let i = 0; i < points.length; i++) {
            polygon.addPoint(points[i].x, points[i].y);
        }

        return polygon;
    }

    function drawL() {
        let polygon = new Polygon([], [], 0);
        polygon.addPoint(x, y);
        polygon.addPoint(x + sz / 4, y);

        polygon.addPoint(x + sz / 4, y + 3 * sz / 4);
        polygon.addPoint(x + sz, y + 3 * sz / 4);

        polygon.addPoint(x + sz, y + sz);

        polygon.addPoint(x, y + sz);
        polygon.addPoint(x, y);
        return polygon;
    }

    function drawFlippedL() {
        let polygon = new Polygon([], [], 0);

        polygon.addPoint(x + 3 * sz / 4, y);
        polygon.addPoint(x + sz, y);

        polygon.addPoint(x + sz, y + sz);
        polygon.addPoint(x, y + sz);

        polygon.addPoint(x, y + 3 * sz / 4);
        polygon.addPoint(x + 3 * sz / 4, y + 3 * sz / 4);

        polygon.addPoint(x + 3 * sz / 4, y);

        return polygon;
    }

    function drawInvertedL() {
        let polygon = new Polygon([], [], 0);

        polygon.addPoint(x, y);
        polygon.addPoint(x + sz, y);

        polygon.addPoint(x + sz, y + sz / 4);
        polygon.addPoint(x + sz / 4, y + sz / 4);

        polygon.addPoint(x + sz / 4, y + sz);
        polygon.addPoint(x, y + sz);

        polygon.addPoint(x, y);

        return polygon;
    }

    function drawFlippedInvertedL() {
        let polygon = new Polygon([], [], 0);

        polygon.addPoint(x, y);
        polygon.addPoint(x + sz, y);

        polygon.addPoint(x + sz, y + sz);
        polygon.addPoint(x + 3 * sz / 4, y + sz);

        polygon.addPoint(x + 3 * sz / 4, y + sz / 4);
        polygon.addPoint(x, y + sz / 4);

        polygon.addPoint(x, y);

        return polygon;
    }

    function drawU() {
        let polygon = new Polygon([], [], 0);
        polygon.addPoint(x, y);
        polygon.addPoint(x + sz / 4, y);

        polygon.addPoint(x + sz / 4, y + 3 * sz / 4);
        polygon.addPoint(x + 3 * sz / 4, y + 3 * sz / 4);

        polygon.addPoint(x + 3 * sz / 4, y);
        polygon.addPoint(x + sz, y);

        polygon.addPoint(x + sz, y + sz);

        polygon.addPoint(x, y + sz);
        polygon.addPoint(x, y);
        return polygon;
    }

    function drawInvertedU() {
        let polygon = new Polygon([], [], 0);
        polygon.addPoint(x, y);
        polygon.addPoint(x + sz, y);

        polygon.addPoint(x + sz, y + sz);
        polygon.addPoint(x + 3 * sz / 4, y + sz);

        polygon.addPoint(x + 3 * sz / 4, y + sz / 4);
        polygon.addPoint(x + sz / 4, y + sz / 4);

        polygon.addPoint(x + sz / 4, y + sz);

        polygon.addPoint(x, y + sz);
        polygon.addPoint(x, y);
        return polygon;
    }

    function drawPlus() {
        let polygon = new Polygon([], [], 0);
        let t = sz / 4;
        polygon.addPoint(x + 3 * sz / 8, y);
        polygon.addPoint(x + 3 * sz / 8, y + 3 * sz / 8);
        polygon.addPoint(x, y + 3 * sz / 8);
        polygon.addPoint(x, y + 5 * sz / 8);
        polygon.addPoint(x + 3 * sz / 8, y + 5 * sz / 8);
        polygon.addPoint(x + 3 * sz / 8, y + sz);
        polygon.addPoint(x + 5 * sz / 8, y + sz);
        polygon.addPoint(x + 5 * sz / 8, y + 5 * sz / 8);
        polygon.addPoint(x + sz, y + 5 * sz / 8);
        polygon.addPoint(x + sz, y + 3 * sz / 8);
        polygon.addPoint(x + 5 * sz / 8, y + 3 * sz / 8);
        polygon.addPoint(x + 5 * sz / 8, y);
        return polygon;
    }

    function drawHexagon() {
        let polygon = new Polygon([], [], 0);
        polygon.addPoint(x + sz / 4, y);
        polygon.addPoint(x + 3 * sz / 4, y);

        polygon.addPoint(x + sz, y + sz / 2);
        polygon.addPoint(x + 3 * sz / 4, y + sz);

        polygon.addPoint(x + sz / 4, y + sz);

        polygon.addPoint(x, y + sz / 2);
        polygon.addPoint(x + sz / 4, y);
        return polygon;
    }

    let functions = [drawL, drawFlippedL, drawInvertedL, drawFlippedInvertedL, drawU, drawInvertedU, drawPlus, drawHexagon, drawShapeless];
    let index = this.rnd.nextInt(functions.length);
    let polygon = functions[index]();

    if (!fill) {
        fill = this.rnd.nextInt(4) > 0;
    }
    if (fill) {
        g.fillPolygon(polygon);
    } else {
        g.drawPolygon(polygon);
    }
};


MysteryImage.prototype.drawRotatedRect = function (x, y, sz, angDeg, fill) {
    let g = this.g;
    let w = sz;
    let halfSz = sz / 2;
    let h = (halfSz) + this.rnd.nextInt(halfSz + 1);

    w = this.rnd.nextBool() ? h : w;

    let dim = [w, h];

    let ind = this.rnd.nextInt(2);
    w = dim[ind];
    h = ind === 0 ? dim[1] : dim[0];

    g.rotateDegsAt(angDeg, x + w / 2, y + h / 2, function () {
        if (fill) {
            g.fillRect(-w / 2, -h / 2, w, h);
        } else {
            g.drawRect(-w / 2, -h / 2, w, h);
        }
    });
};


MysteryImage.prototype.drawCircle = function (x, y, sz, fill) {
    let g = this.g;
    let halfSz = sz / 2;

    if (fill) {
        g.fillCircle(x, y, halfSz);
    } else {
        g.drawCircle(x, y, halfSz);
    }

};


MysteryImage.prototype.drawOval = function (x, y, sz, fill) {
    let g = this.g;
    let w = sz;
    let halfSz = sz / 2;
    let h = (halfSz) + this.rnd.nextInt(halfSz + 1);

    w = this.rnd.nextBool() ? h : w;

    let dim = [w, h];

    let ind = this.rnd.nextInt(2);
    w = dim[ind];
    h = ind === 0 ? dim[1] : dim[0];

    if (fill) {
        g.fillOval(x, y, w, h);
    } else {
        g.drawOval(x, y, w, h);
    }
};


MysteryImage.prototype.drawRotatedOval = function (x, y, sz, angDeg, fill) {
    let g = this.g;
    let w = sz;
    let halfSz = sz / 2;
    let h = (halfSz) + this.rnd.nextInt(halfSz + 1);

    w = this.rnd.nextBool() ? h : w;

    let dim = [w, h];

    let ind = this.rnd.nextInt(2);
    w = dim[ind];
    h = ind === 0 ? dim[1] : dim[0];
    g.rotateDegsAt(angDeg, x, y, function () {
        if (fill) {
            g.fillOval(0, 0, w, h);
        } else {
            g.drawOval(0, 0, w, h);
        }
    });
};

/**
 *
 * @param x The x loc of the start of the line
 * @param y The y loc of the start of the line
 * @param len The length of the line
 * @param angDeg The angle to rotate the line through
 */
MysteryImage.prototype.drawLine = function (x, y, len, angDeg) {
    let g = this.g;
    let halfSz = len / 2;

    g.rotateDegsAt(angDeg, x + halfSz, y + halfSz, function () {
        g.drawLine(-halfSz, -halfSz, -halfSz + len, -halfSz);
    });
};

/**
 * @param {number} x The x location of the square that contains the star
 * @param {number} y         The y location of the square that contains the star
 * @param {number} size      The size of the square that contains the star
 * @param {number} thickness The thickness of the prong-base of the star
 * @param {boolean} fill      If true, fills the star with color
 */
MysteryImage.prototype.drawStar = function (x, y, size, thickness, fill) {
    let g = this.g;

    let halfThickness = (0.5 * thickness);
    let halfSz = (0.5 * size);

    let cen = new Point(x + halfSz, y + halfSz);

    // A square of side length equal to the supplied thickness. It lives at the center of the square that contains the star.
    // The bases of the stars prongs rest on this rectangle

    let lf = cen.x - halfThickness;
    let tp = cen.y - halfThickness;
    let rt = lf + thickness;
    let btm = tp + thickness;
    let cenBox = new Rectangle(lf, tp, rt, btm);

    let xPts = [x, cenBox.left, x + halfSz, cenBox.right(), x + size, cenBox.right(), x + halfSz, cenBox.left, x],
        yPts = [y + halfSz, cenBox.top, y, cenBox.top, y + halfSz, cenBox.bottom(), y + size, cenBox.bottom(), y + halfSz],
        nPts = 9;
    if (fill) {
        g.fillPolygonFromVertices(xPts, yPts, nPts);
    } else {
        g.drawPolygonFromVertices(xPts, yPts, nPts);
    }


};
/**
 * Draws a star that has been rotated
 * @param {number} x The x location of the square that contains the star
 * @param {number} y         The y location of the square that contains the star
 * @param {number} size      The size of the square that contains the star
 * @param {number} thickness The thickness of the prong-base of the star
 * @param {number} angDeg The angle of rotation of the star
 * @param {boolean} fill      If true, fills the star with color
 */
MysteryImage.prototype.drawRotatedStar = function (x, y, size, thickness, angDeg, fill) {
    let g = this.g;
    let self = this;
    let halfSz = size / 2;
    g.rotateDegsAt(angDeg, x + halfSz, y + halfSz, function () {
        self.drawStar(-halfSz, -halfSz, size, thickness, fill);
    });
};

MysteryImage.prototype.drawTriangle = function (x, y, size, fill) {
    let g = this.g;
    let halfSz = (0.5 * size);
    let xPts = [x + halfSz, x, x + size, x + halfSz];
    let yPts = [y, y + size, y + size, y];
    if (fill) {
        g.fillPolygonFromVertices(xPts, yPts, xPts.length);
    } else {
        g.drawPolygonFromVertices(xPts, yPts, xPts.length);
    }
};

MysteryImage.prototype.drawRotatedTriangle = function (x, y, size, angDeg, fill) {
    let g = this.g;
    let self = this;
    let halfSz = size / 2;
    g.rotateDegsAt(angDeg, x + halfSz, y + halfSz, function () {
        self.drawTriangle(-halfSz, -halfSz, size, fill);
    });
};

MysteryImage.prototype.drawText = function (x, y) {
    if (this.textArray && this.textArray.length > 0) {
        let g = this.g;
        let len = this.textArray.length;
        let index = this.rnd.nextInt(len);
        let txt = this.textArray[index];
        let w = g.stringWidth(txt);
        let h = g.textHeight(txt);
        g.drawString(txt, x, y + h);
        return { width: w, height: h };
    }
};

MysteryImage.prototype.drawRotatedText = function (x, y, size, angDeg) {
    if (this.textArray && this.textArray.length > 0) {
        let g = this.g;
        let self = this;
        let index = this.rnd.nextInt(this.textArray.length);
        let txt = this.textArray[index];
        let halfSz = size / 2;
        let h = g.textHeight(txt);
        g.rotateDegsAt(angDeg, x + halfSz, y + halfSz, function () {
            self.drawText(-halfSz, h - halfSz);
        });
    }
};

MysteryImage.prototype.drawBus = function (x, y, sz) {
    let g = this.g;
    let bus = new BusView(sz, this.fgColor, invertColor(this.fgColor), 16);
    bus.draw();
    g.drawImageAtLocWithSize(bus.imageCache, x, y, sz, sz);
    bus.cleanup();
};

MysteryImage.prototype.drawRotatedBus = function (x, y, sz, angDeg) {
    let g = this.g;
    let bus = new BusView(sz, this.fgColor, invertColor(this.fgColor), 16);
    bus.draw();
    let image = bus.imageCache;
    let self = this;
    let halfSz = sz / 2;
    g.rotateDegsAt(angDeg, x + halfSz, y + halfSz, function () {
        g.drawImage(image, -halfSz, -halfSz);
        // let imageView = document.getElementById("imager");
        // imageView.src = bus.g.getCanvas().toDataURL("image/png");
        bus.cleanup();
    });
};

MysteryImage.prototype.generateRect = function (w, h) {

    let ww = w / PIXEL_RATIO;
    let hh = h / PIXEL_RATIO;
    let mnsz = this.minSize / PIXEL_RATIO;
    let sz = mnsz + this.rnd.nextInt(mnsz + 1);

    let x = this.rnd.nextInt(ww);
    let y = this.rnd.nextInt(hh);

    if (x + sz >= ww) {
        x = ww - 2 * sz;
    }
    if (y + sz >= hh) {
        y = hh - 2 * sz;
    }

    return new Rectangle(x, y, x + sz, y + sz);
};
MysteryImage.prototype.maxIterations = function () {
    return 12 * this.numShapes;
};


function calibrate(g, w, h, font) {

    let alpha = g.getAlpha();
    g.setAlpha(1);
    g.setColor('pink');
    g.setBackground("white");

    let fnt = new Font(FontStyle.REGULAR, 8, "Kartika", CssSizeUnits.PX, "normal")

    let step = 50;
    for (let x = 0; x < w; x += step) {
        g.drawLine(x, 0, x, 20);
        g.setFont(fnt);
        g.drawString("" + x, x, 30);
        g.setFont(font);
    }


    g.setColor('pink');
    g.setBackground("white");

    for (let y = 0; y < h; y += step) {
        g.setFont(font);
        g.drawLine(0, y, 20, y);
        g.setFont(fnt);
        g.drawString("" + y, 30, y);
    }
    g.setAlpha(alpha);
}

MysteryImage.prototype.baseDraw = function (w, h) {
    let g = this.g;
    let area = w * h;
    let rnd = this.rnd;
    g.setAlpha(this.bgOpacityEnabled === true ? this.opacity : 1);
    g.setBackground(this.bgColor);
    g.fillRect(0, 0, w, h);

    let maxIters = this.maxIterations();

    //calibrate(g, w, h, this.font);
    g.setAlpha(this.opacity);

    if (this.shapesDensity > 0) {
        this.numShapes = this.shapesDensity * area * MysteryConstants.DENSITY_SCALE;
    }
    let attempts = 0;
    let rects = [];


    while (rects.length < this.numShapes && attempts < maxIters) {

        if (this.mode.toLowerCase() === MysteryModes.ALL.toLowerCase()) {
            if (this.textOnly) {
                this.state = rnd.nextBool() ? MysteryConstants.DRAW_TEXT : MysteryConstants.DRAW_ROTATED_TEXT;
            } else {
                this.state = 1 + rnd.nextInt(this.textArray.length === 0 ? MysteryConstants.DRAW_POLYGON : MysteryConstants.DRAW_ROTATED_TEXT);
            }
        } else {
            this.selectStateFromMode(this.mode);
        }


        let fill = rnd.nextBool();
        let angDeg = 1 + rnd.nextInt(360);

        let r = this.generateRect(w, h);
        r.angle = angDeg;


        let clashOccurred = false;

        for (let i = 0; i < rects.length; i++) {
            let rect = rects[i];
            if (r.intersects(rect)) {
                clashOccurred = true;
                break;
            }
        }


        g.setBackground(this.fgColor);

        if (clashOccurred) {
            attempts++;

        } else {
            rects.push(r);
            g.setColor(this.fgColor);
            g.setBackground(this.fgColor);
            switch (this.state) {

                case MysteryConstants.DRAW_SQUARE:
                    this.drawSquare(r.left, r.top, r.width, fill);
                    break;
                case MysteryConstants.DRAW_RECT:
                    this.drawRect(r.left, r.top, r.width, fill);
                    break;
                case MysteryConstants.DRAW_CIRCLE:
                    this.drawCircle(r.left, r.top, r.width, this.mode.toLowerCase() === MysteryModes.CIRCLE ? true : fill);
                    break;
                case MysteryConstants.DRAW_OVAL:
                    this.drawOval(r.left, r.top, r.width, fill);
                    break;
                case MysteryConstants.DRAW_LINE:
                    this.drawLine(r.left, r.top, r.width, angDeg);
                    break;
                case MysteryConstants.DRAW_STAR:
                    this.drawStar(r.left, r.top, r.width, r.width / 4, fill);
                    break;
                case MysteryConstants.DRAW_ROTATED_STAR:
                    this.drawRotatedStar(r.left, r.top, r.width, r.width / 4, angDeg, fill);
                    break;
                case MysteryConstants.DRAW_TRIANGLE:

                    this.drawTriangle(r.left, r.top, r.width, fill);
                    break;
                case MysteryConstants.DRAW_ROTATED_SQUARE:
                    this.drawRotatedSquare(r.left, r.top, r.width, angDeg, fill);
                    break;
                case MysteryConstants.DRAW_ROTATED_RECT:
                    this.drawRotatedRect(r.left, r.top, r.width, angDeg, fill);
                    break;
                case MysteryConstants.DRAW_ROTATED_TRIANGLE:
                    this.drawRotatedTriangle(r.left, r.top, r.width, angDeg, fill);
                    break;
                case MysteryConstants.DRAW_TEXT:
                    this.drawText(r.left, r.top, r.width);
                    break;
                case MysteryConstants.DRAW_ROTATED_TEXT:
                    this.drawRotatedText(r.left, r.top, r.width, angDeg);
                    break;
                case MysteryConstants.DRAW_ROTATED_OVAL:
                    this.drawRotatedOval(r.centerX(), r.centerY(), r.width, angDeg);
                    break;
                case MysteryConstants.DRAW_POLYGON:
                    this.drawPolygon(r.left, r.top, r.width, fill);
                    break;
                case MysteryConstants.DRAW_DOT:
                    this.drawDot(r.left, r.top, 4);
                    break;
                case MysteryConstants.DRAW_DOT2:
                    this.drawDoubleDot(r.left, r.top, 8)
                    break;

                default:
                    break;
            }
            r.state = this.state;
        }

    }

};
/**
 *
 * @param {String} mode
 */
MysteryImage.prototype.selectStateFromMode = function (mode) {
    let rnd = this.rnd;
    switch (mode.toLowerCase()) {
        case MysteryModes.OVAL:
            this.state = rnd.nextBool() ? MysteryConstants.DRAW_OVAL : MysteryConstants.DRAW_ROTATED_OVAL;
            break;
        case MysteryModes.DOT:
            this.state = MysteryConstants.DRAW_DOT;
            break;
        case MysteryModes.DOT2:
            this.state = MysteryConstants.DRAW_DOT2;
            break;
        case MysteryModes.CIRCLE:
            this.state = MysteryConstants.DRAW_CIRCLE;
            break;
        case MysteryModes.TEXT:
            this.state = rnd.nextBool() ? MysteryConstants.DRAW_TEXT : MysteryConstants.DRAW_ROTATED_TEXT;
            break;
        case MysteryModes.TRIANGLE:
            this.state = rnd.nextBool() ? MysteryConstants.DRAW_TRIANGLE : MysteryConstants.DRAW_ROTATED_TRIANGLE;
            break;
        case MysteryModes.STAR:
            this.state = rnd.nextBool() ? MysteryConstants.DRAW_STAR : MysteryConstants.DRAW_ROTATED_STAR;
            break;
        case MysteryModes.LINE:
            this.state = MysteryConstants.DRAW_LINE;
            break;
        case MysteryModes.SQUARE:
            this.state = rnd.nextBool() ? MysteryConstants.DRAW_SQUARE : MysteryConstants.DRAW_ROTATED_SQUARE;
            break;
        case MysteryModes.POLYGON:
            this.state = MysteryConstants.DRAW_POLYGON;
            break;
        case MysteryModes.COMBO:
            let chosenMode = this.comboArray[rnd.nextInt(this.comboArray.length)];
            this.selectStateFromMode(chosenMode);
            break;
        default:
            break;
    }
};


MysteryImage.prototype.draw = function () {
    let g = this.g;
    let w = g.width;
    let h = g.height;

    if (this.cacheAfterDraw) {
        if (this.imageCache !== null) {
            g.drawImageAtLocWithSize(this.imageCache, 0, 0, w, h);
        } else {
            this.baseDraw(w, h);
            this.imageCache = g.getImageData(0, 0, w, h);
        }
    } else {
        this.baseDraw(w, h);
        this.imageCache = g.getImageData(0, 0, w, h);
    }
    return this.imageCache;
};//end draw method

//End MysteryImages


function drawBus(width, mainColor, minorColor) {
    let bus = new BusView(sz, mainColor, minorColor, width);
    bus.draw();
    let img = bus.imageCache;
    bus.cleanup();
    return img;
}

function drawStar(width, color, fill) {

    let g = NewGraphics(width, width);
    g.setBackground(color);

    let halfThickness = (0.5 * thickness);
    let halfSz = (0.5 * size);

    let cen = new Point(x + halfSz, y + halfSz);

    // A square of side length equal to the supplied thickness. It lives at the center of the square that contains the star.
    // The bases of the stars prongs rest on this rectangle

    let lf = cen.x - halfThickness;
    let tp = cen.y - halfThickness;
    let rt = lf + thickness;
    let btm = tp + thickness;
    let cenBox = new Rectangle(lf, tp, rt, btm);

    let xPts = [x, cenBox.left, x + halfSz, cenBox.right(), x + size, cenBox.right(), x + halfSz, cenBox.left, x],
        yPts = [y + halfSz, cenBox.top, y, cenBox.top, y + halfSz, cenBox.bottom(), y + size, cenBox.bottom(), y + halfSz],
        nPts = 9;
    if (fill) {
        g.fillPolygonFromVertices(xPts, yPts, nPts);
    } else {
        g.drawPolygonFromVertices(xPts, yPts, nPts);
    }
    let img = g.getCanvas();
    g.clear();
    g.getCanvas().remove();
}

//BusView
function BusView(busWidth, mainColor, minorColor, busRadius) {

    this.mainColor = mainColor;
    this.minorColor = minorColor;
    this.busRadius = busRadius;

    this.imageCache = null;//ImageData
    let canvas = this.makeCanvas(busWidth, busWidth);
    this.g = new Graphics(canvas);

    this.alphaRange = {
        MIN_ALPHA: 80,
        MAX_ALPHA: 255
    };

    this.opacityValue = this.alphaRange.MIN_ALPHA;
    this.busArchitecture = new BusArchitecture(busWidth);
}


BusView.prototype.makeCanvas = function (w, h) {
    let canvas = document.createElement('canvas');
    canvas.id = "bus-canv-" + new Date().getTime();

    canvas.width = w;
    canvas.height = h;
    canvas.style.border = "0px solid";
    document.body.appendChild(canvas);
    return canvas;
};
BusView.prototype.cleanup = function () {
    this.imageCache = null;
    this.g.clear();
    this.g.getCanvas().remove();
};


function BusArchitecture(busWidth) {
    if (!busWidth || typeof busWidth !== "number") {
        throw 'invalid argument for bus width';
    }
    this.busWidth = busWidth;
    this.busHeight = 0;
    this.busWheelWidth = 0;
    this.busWheelsSpan = 0;
    this.busWheelsY = 0;
    this.busSemiCircularHollowForWheelWidth = 0;
    this.busSemiCircularHollowForWheelY = 0;
    this.busSemiCircularHollowSpan = 0;
    this.busRimWidth = 0;//inner circle in bus wheel
    this.busLowerRectWidth = 0;
    this.busLowerRectHeight = 0;
    this.busLowerRectX = 0;
    this.busLowerRectY = 0;
    this.busWindowX = 0;
    this.busWindowY = 0;
    this.busWindowWidth = 0;
    this.busWindowHeight = 0;
    this.busWindowGap = 0;


    this.busLowerRodBetweenTiresWidth = 0;
    this.busLowerRodBetweenTiresHeight = 0;
    this.busLowerRodBetweenTiresX = 0;
    this.busLowerRodBetweenTiresY = 0;


    this.busFenderWidth = 0;
    this.busFenderHeight = 0;
    this.fenderDisplacementBehindBus = 0;
    this.fenderY = 0;

    this.structure = {

        STD_BUS_WIDTH: 920,
        STD_BUS_HEIGHT: 572,
        STD_BUS_WHEEL_WIDTH: 176,
        STD_BUS_WHEEL_Y: 490,
        STD_BUS_SEMI_CIRCLE_HOLLOW_FOR_WHEEL_Y: 485,
        STD_BUS_SEMI_CIRCLE_HOLLOW_FOR_WHEEL_WIDTH: 188,
        /**
         * Distance from the left of the first semi-circle containing the first wheel
         * to the right of the second semi-circle containing the second wheel
         */
        STD_BUS_SEMI_CIRCLE_HOLLOW_SPAN: 690,
        STD_BUS_RIM_WIDTH: 90,
        STD_BUS_LOWER_RECT_WIDTH: 665,
        STD_BUS_LOWER_RECT_HEIGHT: 203,
        STD_BUS_LOWER_RECT_X: 124,
        STD_BUS_LOWER_RECT_Y: 266,


        STD_BUS_LOWER_ROD_BETWEEN_TIRES_WIDTH: 320,
        STD_BUS_LOWER_ROD_BETWEEN_TIRES_HEIGHT: 20,
        STD_BUS_LOWER_ROD_BETWEEN_TIRES_X: 296,
        STD_BUS_LOWER_ROD_BETWEEN_TIRES_Y: 508,

        /**
         * The x location of the first bus window counting
         * from the left
         */
        STD_BUS_WINDOW_X: 123,
        STD_BUS_WINDOW_Y: 100,
        /**
         * Distance from left of left wheel to right of right wheel
         */
        STD_BUS_WHEELS_SPAN: 682,

        STD_BUS_WINDOW_WIDTH: 160,
        STD_BUS_WINDOW_HEIGHT: 130,
        STD_BUS_WINDOW_GAP: 92.5,
        STD_BUS_FENDER_WIDTH: 969,
        STD_BUS_FENDER_HEIGHT: 85,
        /**
         * Standard distance between the back of the fender and the back of the bus's body
         */
        STD_BUS_FENDER_DISPLACEMENT_BEHIND_BUS: 12,
        STD_BUS_FENDER_Y: 485
    };

    this.init();
}

BusArchitecture.prototype.init = function () {
    let ratio = (this.busWidth / this.structure.STD_BUS_WIDTH);
    this.busHeight = (ratio * this.structure.STD_BUS_HEIGHT);
    this.busWheelWidth = (ratio * this.structure.STD_BUS_WHEEL_WIDTH);
    this.busWheelsY = (ratio * this.structure.STD_BUS_WHEEL_Y);
    this.busSemiCircularHollowForWheelWidth = (ratio * this.structure.STD_BUS_SEMI_CIRCLE_HOLLOW_FOR_WHEEL_WIDTH);
    this.busSemiCircularHollowForWheelY = (ratio * this.structure.STD_BUS_SEMI_CIRCLE_HOLLOW_FOR_WHEEL_Y);
    this.busSemiCircularHollowSpan = (ratio * this.structure.STD_BUS_SEMI_CIRCLE_HOLLOW_SPAN);
    this.busRimWidth = (ratio * this.structure.STD_BUS_RIM_WIDTH);
    this.busLowerRectWidth = (ratio * this.structure.STD_BUS_LOWER_RECT_WIDTH);
    this.busLowerRectHeight = (ratio * this.structure.STD_BUS_LOWER_RECT_HEIGHT);
    this.busLowerRectX = (ratio * this.structure.STD_BUS_LOWER_RECT_X);
    this.busLowerRectY = (ratio * this.structure.STD_BUS_LOWER_RECT_Y);
    this.busWheelsSpan = (ratio * this.structure.STD_BUS_WHEELS_SPAN);

    this.busLowerRodBetweenTiresWidth = (ratio * this.structure.STD_BUS_LOWER_ROD_BETWEEN_TIRES_WIDTH);
    this.busLowerRodBetweenTiresHeight = (ratio * this.structure.STD_BUS_LOWER_ROD_BETWEEN_TIRES_HEIGHT);

    this.busLowerRodBetweenTiresX = (ratio * this.structure.STD_BUS_LOWER_ROD_BETWEEN_TIRES_X);
    this.busLowerRodBetweenTiresY = (ratio * this.structure.STD_BUS_LOWER_ROD_BETWEEN_TIRES_Y);

    this.busWindowX = (ratio * this.structure.STD_BUS_WINDOW_X);
    this.busWindowY = (ratio * this.structure.STD_BUS_WINDOW_Y);
    this.busWindowWidth = (ratio * this.structure.STD_BUS_WINDOW_WIDTH);
    this.busWindowHeight = (ratio * this.structure.STD_BUS_WINDOW_HEIGHT);
    this.busWindowGap = (ratio * this.structure.STD_BUS_WINDOW_GAP);
    this.busFenderWidth = (ratio * this.structure.STD_BUS_FENDER_WIDTH);
    this.busFenderHeight = (ratio * this.structure.STD_BUS_FENDER_HEIGHT);
    this.fenderDisplacementBehindBus = (ratio * this.structure.STD_BUS_FENDER_DISPLACEMENT_BEHIND_BUS);
    this.fenderY = (ratio * this.structure.STD_BUS_FENDER_Y);
};

/**
 *
 */
BusView.prototype.drawBus = function () {

    let g = this.g;

    let r_big = this.busRadius <= 0 ? 16 : this.busRadius;
    let r_small = 4;

    let w = this.busArchitecture.busWidth;
    let h = this.busArchitecture.busHeight;
    let x = (0.5 * (g.width - w));
    let y = (0.5 * (g.height - h));

    g.setBackground(this.mainColor);
    g.fillRoundRect(x, y, w, h, r_big);

    let fenderDisp = this.busArchitecture.fenderDisplacementBehindBus;
    let fenderX = x - fenderDisp;
    let fenderY = y + this.busArchitecture.fenderY;

    //draw the fender
    g.fillRoundRect(fenderX, fenderY, this.busArchitecture.busFenderWidth, this.busArchitecture.busFenderHeight, r_big);

    //draw the windows
    g.setBackground(this.minorColor);
    let bx = x + this.busArchitecture.busWindowX;
    let by = y + this.busArchitecture.busWindowY;
    g.fillRoundRect(bx, by, this.busArchitecture.busWindowWidth, this.busArchitecture.busWindowHeight, r_small);

    bx += this.busArchitecture.busWindowWidth + this.busArchitecture.busWindowGap;
    g.fillRoundRect(bx, by, this.busArchitecture.busWindowWidth, this.busArchitecture.busWindowHeight, r_small);

    bx += this.busArchitecture.busWindowWidth + this.busArchitecture.busWindowGap;
    g.fillRoundRect(bx, by, this.busArchitecture.busWindowWidth, this.busArchitecture.busWindowHeight, r_small);

    //drawArc = function (cenX, cenY, radius, startAngle, endAngle, counterclockwise)
    //draw semi circles for tire containers
    let hollowForWheelY = y + this.busArchitecture.busSemiCircularHollowForWheelY;

    let hollowWidth = this.busArchitecture.busSemiCircularHollowForWheelWidth;
    let hollowDispFromSides = ((w - this.busArchitecture.busSemiCircularHollowSpan) * 0.5);
    let hollowForWheelX = x + hollowDispFromSides;

    //draw hollows for wheels...left
    g.drawArcFromTopLeft(hollowForWheelX, hollowForWheelY, hollowForWheelX + hollowWidth,
        hollowForWheelY + hollowWidth, -180, 180, true);

    hollowForWheelX = x + (w - hollowDispFromSides - hollowWidth);
    //draw hollows for wheels...right
    g.drawArcFromTopLeft(hollowForWheelX, hollowForWheelY, hollowForWheelX + hollowWidth,
        hollowForWheelY + hollowWidth, -180, 180, true);


    //draw wheels:
    g.setBackground(this.mainColor);
    let wheelsDisplacementFromBusEnds = ((w - this.busArchitecture.busWheelsSpan) * 0.5);
    let wheelRad = (this.busArchitecture.busWheelWidth * 0.5);
    let leftWheelCenX = (x + wheelsDisplacementFromBusEnds + wheelRad);
    let rightWheelCenX = x + (w - wheelsDisplacementFromBusEnds - wheelRad);
    let wheelY = y + this.busArchitecture.busWheelsY;

    g.fillCircle(leftWheelCenX, wheelY + wheelRad, wheelRad);
    g.fillCircle(rightWheelCenX, wheelY + wheelRad, wheelRad);


    g.setColor(this.minorColor);
    g.drawCircle(leftWheelCenX, wheelY + wheelRad, wheelRad);
    g.drawCircle(rightWheelCenX, wheelY + wheelRad, wheelRad);

    let rimRadius = (this.busArchitecture.busRimWidth * 0.5);

    g.setBackground(this.minorColor);
    //draw wheel rims
    //left rim is concentric with left wheel
    g.fillCircle(leftWheelCenX, wheelY + wheelRad, rimRadius);
    //right rim is concentric with left wheel
    g.fillCircle(rightWheelCenX, wheelY + wheelRad, rimRadius);


    //draw lower rect
    g.setColor(this.minorColor);
    g.setStrokeWidth(1.5);
    g.setAlpha(this.opacityValue);

    let left = x + this.busArchitecture.busLowerRectX;
    let top = y + this.busArchitecture.busLowerRectY;
    g.drawRoundRect(left, top, this.busArchitecture.busLowerRectWidth, this.busArchitecture.busLowerRectHeight, r_small);

    //draw lower rod between wheels
    left = x + this.busArchitecture.busLowerRodBetweenTiresX;
    top = y + this.busArchitecture.busLowerRodBetweenTiresY;
    let right = left + this.busArchitecture.busLowerRodBetweenTiresWidth;
    let bottom = top + this.busArchitecture.busLowerRodBetweenTiresHeight;

    g.setBackground(this.minorColor);
    g.setAlpha(this.alphaRange.MAX_ALPHA);
    g.fillRoundRect(left, top, this.busArchitecture.busLowerRodBetweenTiresWidth, this.busArchitecture.busLowerRodBetweenTiresHeight, r_small);

};
/**
 *
 */
BusView.prototype.draw = function () {
    let g = this.g;
    let w = g.width;
    let h = g.height;
    if (this.imageCache != null) {
        g.drawImageAtLocWithSize(this.imageCache, 0, 0, w, h);
    } else {
        this.drawBus();
        this.imageCache = g.getCanvas();
    }
};
//End BusView


let getTextSize = function (text, font) {
    if (typeof text === 'string') {
        if (text.length === 0) {
            return new Rectangle(0, 0, 0, 0);
        }
        let cv = document.createElement('canvas');

        cv.width = 1024;
        cv.height = 190;
        cv.style.width = cv.width + 'px';
        cv.style.height = cv.height + 'px';
        document.body.appendChild(cv);

        let gg = new Graphics(cv);
        gg.ctx.font = font;

        gg.setBackground('#000');
        gg.drawString(text, 10, cv.height / 2);

        let rect = gg.getBoundingBox();
        cv.remove();
        gg.clear();
        gg.destroy();
        gg = null;
        return rect;
    }

    return null;
};


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
        blob = new Blob([fullWorkerStr], { type: 'text/javascript' });
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
            throw (new Error("Worker requested function " + e.data.foo + ". But it is not available."));
        }
    }

    // build an array of functions for the main part of main-thread-calls-function-in-worker operation
    var ret = { blobURL: url };//this is useful to know for debugging if you have loads of bridged workers in blobs with random names
    var makePostMessageForFunction = function (name, hasBuffers) {
        if (hasBuffers)
            return function (/*args...,[ArrayBuffer,..]*/) {
                var args = Array.prototype.slice.call(arguments);
                var buffers = args.pop();
                worker.postMessage({ foo: name, args: args }, buffers);
            }
        else
            return function (/*args...*/) {
                var args = Array.prototype.slice.call(arguments);
                worker.postMessage({ foo: name, args: args });
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