/**
 * PixelLab Resource Loader
 * Loads resources while providing progress updates.
 */
function PxLoader(settings) {

    // merge settings with defaults
    settings = settings || {};

    // how frequently we poll resources for progress
    if (settings.statusInterval == null) {
        settings.statusInterval = 5000;
        // every 5 seconds by default
    }

    // delay before logging since last progress change
    if (settings.loggingDelay == null) {
        settings.loggingDelay = 20 * 1000;
        // log stragglers after 20 secs
    }

    // stop waiting if no progress has been made in the moving time window
    if (settings.noProgressTimeout == null) {
        settings.noProgressTimeout = Infinity;
        // do not stop waiting by default
    }

    var entries = [], // holds resources to be loaded with their status
    progressListeners = [], timeStarted, progressChanged = +new Date;

    /**
     * The status of a resource
     * @enum {number}
     */
    var ResourceState = {
        QUEUED : 0,
        WAITING : 1,
        LOADED : 2,
        ERROR : 3,
        TIMEOUT : 4
    };

    // places non-array values into an array.
    var ensureArray = function(val) {
        if (val == null) {
            return [];
        }

        if (Array.isArray(val)) {
            return val;
        }

        return [val];
    };

    // add an entry to the list of resources to be loaded
    this.add = function(resource) {

        // ensure tags are in an object
        resource.tags = new PxLoaderTags(resource.tags);

        // ensure priority is set
        if (resource.priority == null) {
            resource.priority = Infinity;
        }

        entries.push({
            resource : resource,
            state : ResourceState.QUEUED
        });
    };

    this.addProgressListener = function(callback, tags) {
        progressListeners.push({
            callback : callback,
            tags : new PxLoaderTags(tags)
        });
    };

    this.addCompletionListener = function(callback, tags) {
        progressListeners.push({
            tags : new PxLoaderTags(tags),
            callback : function(e) {
                if (e.completedCount === e.totalCount) {
                    callback();
                }
            }
        });
    };

    // creates a comparison function for resources
    var getResourceSort = function(orderedTags) {

        // helper to get the top tag's order for a resource
        orderedTags = ensureArray(orderedTags);
        var getTagOrder = function(entry) {
            var resource = entry.resource, bestIndex = Infinity;
            for (var i = 0; i < resource.tags.length; i++) {
                for (var j = 0; j < Math.min(orderedTags.length, bestIndex); j++) {
                    if (resource.tags[i] == orderedTags[j] && j < bestIndex) {
                        bestIndex = j;
                        if (bestIndex === 0)
                            break;
                    }
                    if (bestIndex === 0)
                        break;
                }
            }
            return bestIndex;
        };

        return function(a, b) {
            // check tag order first
            var aOrder = getTagOrder(a), bOrder = getTagOrder(b);
            if (aOrder < bOrder)
                return -1;
            if (aOrder > bOrder)
                return 1;

            // now check priority
            if (a.priority < b.priority)
                return -1;
            if (a.priority > b.priority)
                return 1;
            return 0;
        }
    };

    this.start = function(orderedTags) {
        timeStarted = +new Date;

        // first order the resources
        var compareResources = getResourceSort(orderedTags);
        entries.sort(compareResources);

        // trigger requests for each resource
        for (var i = 0, len = entries.length; i < len; i++) {
            var entry = entries[i];
            entry.status = ResourceState.WAITING;
            entry.resource.start(this);
        }

        // do an initial status check soon since items may be loaded from the cache
        setTimeout(statusCheck, 100);
    };

    var statusCheck = function() {
        var checkAgain = false, noProgressTime = (+new Date) - progressChanged, timedOut = (noProgressTime >= settings.noProgressTimeout), shouldLog = (noProgressTime >= settings.loggingDelay);

        for (var i = 0, len = entries.length; i < len; i++) {
            var entry = entries[i];
            if (entry.status !== ResourceState.WAITING) {
                continue;
            }

            // see if the resource has loaded
            entry.resource.checkStatus();

            // if still waiting, mark as timed out or make sure we check again
            if (entry.status === ResourceState.WAITING) {
                if (timedOut) {
                    entry.resource.onTimeout();
                } else {
                    checkAgain = true;
                }
            }
        }

        // log any resources that are still pending
        if (shouldLog && checkAgain) {
            log();
        }

        if (checkAgain) {
            setTimeout(statusCheck, settings.statusInterval);
        }
    };

    this.isBusy = function() {
        for (var i = 0, len = entries.length; i < len; i++) {
            if (entries[i].status === ResourceState.QUEUED || entries[i].status === ResourceState.WAITING) {
                return true;
            }
        }
        return false;
    };

    var onProgress = function(resource, statusType) {
        // find the entry for the resource
        var entry = null;
        for (var i = 0, len = entries.length; i < len; i++) {
            if (entries[i].resource === resource) {
                entry = entries[i];
                break;
            }
        }

        // we have already updated the status of the resource
        if (entry == null || entry.status !== ResourceState.WAITING) {
            return;
        }
        entry.status = statusType;
        progressChanged = +new Date;

        var numResourceTags = resource.tags.length;

        // fire callbacks for interested listeners
        for (var i = 0, numListeners = progressListeners.length; i < numListeners; i++) {
            var listener = progressListeners[i], shouldCall;

            if (listener.tags.length === 0) {
                // no tags specified so always tell the listener
                shouldCall = true;
            } else {
                // listener only wants to hear about certain tags
                shouldCall = resource.tags.contains(listener.tags);
            }

            if (shouldCall) {
                sendProgress(entry, listener);
            }
        }
    };

    this.onLoad = function(resource) {
        onProgress(resource, ResourceState.LOADED);
    };
    this.onError = function(resource) {
        onProgress(resource, ResourceState.ERROR);
    };
    this.onTimeout = function(resource) {
        onProgress(resource, ResourceState.TIMEOUT);
    };

    // sends a progress report to a listener
    var sendProgress = function(updatedEntry, listener) {
        // find stats for all the resources the caller is interested in
        var completed = 0, total = 0;
        for (var i = 0, len = entries.length; i < len; i++) {
            var entry = entries[i], includeResource = false;

            if (listener.tags.length === 0) {
                // no tags specified so always tell the listener
                includeResource = true;
            } else {
                includeResource = entry.resource.tags.contains(listener.tags);
            }

            if (includeResource) {
                total++;
                if (entry.status === ResourceState.LOADED || entry.status === ResourceState.ERROR || entry.status === ResourceState.TIMEOUT) {
                    completed++;
                }
            }
        }

        listener.callback({
            // info about the resource that changed
            resource : updatedEntry.resource,

            // should we expose StatusType instead?
            loaded : (updatedEntry.status === ResourceState.LOADED),
            error : (updatedEntry.status === ResourceState.ERROR),
            timeout : (updatedEntry.status === ResourceState.TIMEOUT),

            // updated stats for all resources
            completedCount : completed,
            totalCount : total
        });
    };

    // prints the status of each resource to the console
    var log = this.log = function(showAll) {
        if (!window.console) {
            return;
        }

        var elapsedSeconds = Math.round((+new Date - timeStarted) / 1000);
        window.console.log('PxLoader elapsed: ' + elapsedSeconds + ' sec');

        for (var i = 0, len = entries.length; i < len; i++) {
            var entry = entries[i];
            if (!showAll && entry.status !== ResourceState.WAITING) {
                continue;
            }

            var message = 'PxLoader: #' + i + ' ' + entry.resource.getName();
            switch(entry.status) {
                case ResourceState.QUEUED:
                    message += ' (Not Started)';
                    break;
                case ResourceState.WAITING:
                    message += ' (Waiting)';
                    break;
                case ResourceState.LOADED:
                    message += ' (Loaded)';
                    break;
                case ResourceState.ERROR:
                    message += ' (Error)';
                    break;
                case ResourceState.TIMEOUT:
                    message += ' (Timeout)';
                    break;
            }

            if (entry.resource.tags.length > 0) {
                message += ' Tags: [' + entry.resource.tags.join(',') + ']';
            }

            window.console.log(message);
        }
    };
}

// Tag object to handle tag intersection; once created not meant to be changed
// Performance rationale: http://jsperf.com/lists-indexof-vs-in-operator/3
function PxLoaderTags(values) {

    this.array = [];
    this.object = {};
    this.value = null;
    // single value
    this.length = 0;

    if (values !== null && values !== undefined) {
        if (Array.isArray(values)) {
            this.array = values;
        } else if ( typeof values === 'object') {
            for (var key in values) {
                this.array.push(key);
            }
        } else {
            this.array.push(values);
            this.value = values;
        }

        this.length = this.array.length;

        // convert array values to object with truthy values, used by contains function below
        for (var i = 0; i < this.length; i++) {
            this.object[this.array[i]] = true;
        }
    }

    // compare this object with another; return true if they share at least one value
    this.contains = function(other) {
        if (this.length === 0 || other.length === 0) {
            return false;
        } else if (this.length === 1) {
            if (other.length === 1) {
                return this.value === other.value;
            } else {
                return other.object.hasOwnProperty(this.value);
            }
        } else if (other.length < this.length) {
            return other.contains(this);
            // better to loop through the smaller object
        } else {
            for (var key in this.object) {
                if (other.object[key]) {
                    return true;
                }
            }
            return false;
        }
    }
}

// shims to ensure we have newer Array utility methods

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/isArray
if (!Array.isArray) {
    Array.isArray = function(arg) {
        return Object.prototype.toString.call(arg) == '[object Array]';
    };
}
// @depends PxLoader.js

/**
 * PxLoader plugin to load images
 */
function PxLoaderImage(url, tags, priority) {
    var self = this, loader = null;

    this.img = new Image();
    this.tags = tags;
    this.priority = priority;

    var onReadyStateChange = function() {
        if (self.img.readyState == 'complete') {
            removeEventHandlers();
            loader.onLoad(self);
        }
    };

    var onLoad = function() {
        removeEventHandlers();
        loader.onLoad(self);
    };

    var onError = function() {
        removeEventHandlers();
        loader.onError(self);
    };

    var removeEventHandlers = function() {
        self.unbind('load', onLoad);
        self.unbind('readystatechange', onReadyStateChange);
        self.unbind('error', onError);
    };

    this.start = function(pxLoader) {
        // we need the loader ref so we can notify upon completion
        loader = pxLoader;

        // NOTE: Must add event listeners before the src is set. We
        // also need to use the readystatechange because sometimes
        // load doesn't fire when an image is in the cache.
        self.bind('load', onLoad);
        self.bind('readystatechange', onReadyStateChange);
        self.bind('error', onError);

        self.img.src = url;
    };

    // called by PxLoader to check status of image (fallback in case
    // the event listeners are not triggered).
    this.checkStatus = function() {
        if (self.img.complete) {
            removeEventHandlers();
            loader.onLoad(self);
        }
    };

    // called by PxLoader when it is no longer waiting
    this.onTimeout = function() {
        removeEventHandlers();
        if (self.img.complete) {
            loader.onLoad(self);
        } else {
            loader.onTimeout(self);
        }
    };

    // returns a name for the resource that can be used in logging
    this.getName = function() {
        return url;
    };

    // cross-browser event binding
    this.bind = function(eventName, eventHandler) {
        if (self.img.addEventListener) {
            self.img.addEventListener(eventName, eventHandler, false);
        } else if (self.img.attachEvent) {
            self.img.attachEvent('on' + eventName, eventHandler);
        }
    };

    // cross-browser event un-binding
    this.unbind = function(eventName, eventHandler) {
        if (self.img.removeEventListener) {
            self.img.removeEventListener(eventName, eventHandler, false);
        } else if (self.img.detachEvent) {
            self.img.detachEvent('on' + eventName, eventHandler);
        }
    };

}

// add a convenience method to PxLoader for adding an image
PxLoader.prototype.addImage = function(url, tags, priority) {
    var imageLoader = new PxLoaderImage(url, tags, priority);
    this.add(imageLoader);

    // return the img element to the caller
    return imageLoader.img;
};
/**
 * @namespace TGE
 * @description The namespace used for client-side Tresensa Game Engine classes.
 */
var TGE = TGE || {};

// Tresensa logging function for debugging.
TGE.log = function() {
    if (window.console) {
        window.console.log(Array.prototype.slice.call(arguments));
    }
}
// Will need to think of a clever way to be able to disable this without performance implications
TGE.debugLog = function() {
    /*if(window.console)
     {
     window.console.log(Array.prototype.slice.call(arguments));
     }*/
}
// Macro function for implementing inheritence design pattern.
// Source: "Pro JavaScript Design Patterns" book
function extend(subClass, superClass) {
    var subClassPrototype = subClass.prototype;

    var F = function() {
    };
    F.prototype = superClass.prototype;
    subClass.prototype = new F();
    subClass.prototype.constructor = subClass;
    subClass.superclass = superClass.prototype;

    if (superClass.prototype.constructor === Object.prototype.constructor) {
        superClass.prototype.constructor = superClass;
    }

    for (var method in subClassPrototype) {
        if (subClassPrototype.hasOwnProperty(method)) {
            subClass.prototype[method] = subClassPrototype[method];
        }
    }
}

// Implementation of bind function if required.
// Source: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Function/bind
if (!Function.prototype.bind) {
    /** @ignore */
    Function.prototype.bind = function(oThis) {
        if ( typeof this !== "function") {
            // closest thing possible to the ECMAScript 5 internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var aArgs = Array.prototype.slice.call(arguments, 1), fToBind = this,

        /** @ignore */
        fNOP = function() {
        },

        /** @ignore */
        fBound = function() {
            return fToBind.apply(this instanceof fNOP && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
        };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
    };
}

// Shim layer with setTimeout fallback.
// Source: http://paulirish.com/2011/requestanimationframe-for-smart-animating/
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(callback) {
        window.setTimeout(callback, 1000 / 60);
    };
})();

// This function returns an object with x,y properties for the left and top absolute coordinates of the element whose ID is passed as an argument.
// Source: http://js-tut.aardon.de/js-tut/tutorial/position.html
function getElementPosition(element) {
    var elem = element;
    var tagname = "";
    var x = 0;
    var y = 0;

    if (elem == null) {
        return null;
    }

    while (( typeof (elem) == "object") && ( typeof (elem.tagName) != "undefined")) {
        y += elem.offsetTop;
        x += elem.offsetLeft;
        tagname = elem.tagName.toUpperCase();

        if (tagname == "BODY") {
            elem = 0;
        }

        if ( typeof (elem) == "object") {
            if ( typeof (elem.offsetParent) == "object") {
                elem = elem.offsetParent;
            }
        }

        if (elem == null) {
            return null;
        }
    }

    return {
        x : x,
        y : y
    };
}

// Put the querystring variables into an associate array
// Source: http://stackoverflow.com/questions/647259/javascript-query-string
function getQueryString() {
    var result = {}, queryString = location.search.substring(1), re = /([^&=]+)=([^&]*)/g, m;

    while ( m = re.exec(queryString)) {
        result[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
    }

    return result;
}

function getDistributionPartner() {
    // Was a distribution partner id specified?
    var partnerID = getQueryString()["dst"];

    return ( typeof partnerID === "string") ? partnerID : null;
}

// Browser/Device detection code. Taken from: http://www.quirksmode.org/js/detect.html
TGE.BrowserDetect = {
    init : function() {
        this.browser = this.searchString(this.dataBrowser) || "an unknown browser";
        this.version = this.searchVersion(navigator.userAgent) || this.searchVersion(navigator.appVersion) || "an unknown version";
        this.platform = this.searchString(this.dataPlatform) || "an unknown OS or Device";
        this.OSversion = this.detectOSversion(this.platform);
        this.isMobileDevice = !(this.platform === "Windows" || this.platform === "Mac" || this.platform === "Linux");
        this.oniOS = this.platform === "iPhone" || this.platform === "iPad";
        this.onAndroid = this.platform === "Android";
        this.usingPhoneGap = (window.PhoneGap || window.cordova || window.Cordova);
        //alert("browser: " + this.browser + " version: " + this.version + " platform: " + this.platform + " OSversion: " + this.OSversion + " isMobileDevice: " + (this.isMobileDevice ? "yes" : "no"));
    },

    detectOSversion : function(platform) {
        var sVersion = '-1'
        var regExp = ''
        var uagent = navigator.userAgent.toString();

        switch(platform) {
            case 'Windows Phone':
                regExp = /Windows Phone OS\s+[\d\.]+/
                sVersion = String(uagent.match(regExp)).substring(17, 20)
                break;
            case 'iPhone':
            case 'iPad':
                regExp = /OS\s+[\d\_]+/
                sVersion = String(uagent.match(regExp)).substring(3, 6);

                break;
            case 'Windows':
                //http://msdn.microsoft.com/en-us/library/ms537503(v=vs.85).aspx
                regExp = /Windows NT\s+[\d\.]+/
                var sTempVersion = String(uagent.match(regExp)).substring(11, 14);
                if (sTempVersion == '6.1')
                    sVersion = '7'
                else if (sTempVersion == '5.1')
                    sVersion = 'XP'
                else if (sTempVersion == '5.2')
                    sVersion = 'XP'
                else if (sTempVersion == '6.0')
                    sVersion = 'Vista'
                else if (sTempVersion == '5.01')
                    sVersion = '2000 SP1'
                else if (sTempVersion == '5.0')
                    sVersion = '2000'

                break;
            case 'Mac':
                regExp = /Mac OS X\s+[\d\_]+/
                sVersion = String(uagent.match(regExp)).substring(9, 13);
                break;
            case 'Android':
                regExp = /ndroid\s+[\d\.]+/
                sVersion = String(uagent.match(regExp)).substring(7, 10);
                break;
        }
        return sVersion;
    },

    searchString : function(data) {
        for (var i = 0; i < data.length; i++) {
            if (data[i] != null) {
                var dataString = data[i].string;
                var dataProp = data[i].prop;
                this.versionSearchString = data[i].versionSearch || data[i].identity;
                if (dataString) {
                    if (dataString.indexOf(data[i].subString) !== -1)
                        return data[i].identity;
                } else if (dataProp) {
                    return data[i].identity;
                }
            }
        }
    },

    searchVersion : function(dataString) {
        var index = dataString.indexOf(this.versionSearchString);
        if (index === -1)
            return;
        return parseFloat(dataString.substring(index + this.versionSearchString.length + 1));
    },

    dataBrowser : [{
        string : navigator.userAgent,
        subString : "Chrome",
        identity : "Chrome"
    }, {
        // IE was previously MSIE now they call it 'Explorer'
        string : navigator.userAgent,
        subString : "MSIE",
        identity : "Explorer",
        versionSearch : "MSIE"
    }, {
        string : navigator.userAgent,
        subString : "Explorer",
        identity : "Explorer",
        versionSearch : "Explorer"
    }, {
        string : navigator.vendor,
        subString : "Apple",
        identity : "Safari",
        versionSearch : "Version"
    }, {
        string : navigator.userAgent,
        subString : "Firefox",
        identity : "Firefox"
    }, {
        prop : window.opera,
        identity : "Opera"
    }, {// Kindle Fire (Silk)
        string : navigator.userAgent,
        subString : "Silk",
        identity : "Silk",
        versionSearch : "Silk"
    }, {
        string : navigator.userAgent,
        subString : "Gecko",
        identity : "Mozilla",
        versionSearch : "rv"
    }, {// for older Netscapes (4-)
        string : navigator.userAgent,
        subString : "Mozilla",
        identity : "Netscape",
        versionSearch : "Mozilla"
    }, {
        string : navigator.userAgent,
        subString : "OmniWeb",
        versionSearch : "OmniWeb/",
        identity : "OmniWeb"
    }, {
        string : navigator.vendor,
        subString : "iCab",
        identity : "iCab"
    }, {
        string : navigator.vendor,
        subString : "KDE",
        identity : "Konqueror"
    }, {
        string : navigator.vendor,
        subString : "Camino",
        identity : "Camino"
    }, {// for newer Netscapes (6+)
        string : navigator.userAgent,
        subString : "Netscape",
        identity : "Netscape"
    }, {
        string : navigator.vendor,
        subString : "BlackBerry",
        identity : "BlackBerry"
    }],

    dataPlatform : [{
        string : navigator.platform,
        subString : "Windows Phone",
        identity : "Windows Phone"
    }, {
        string : navigator.platform,
        subString : "Win",
        identity : "Windows"
    }, {
        string : navigator.platform,
        subString : "Mac",
        identity : "Mac"
    }, {
        string : navigator.userAgent,
        subString : "iPhone",
        identity : "iPhone"
    }, {
        string : navigator.userAgent,
        subString : "iPad",
        identity : "iPad"
    }, {
        string : navigator.userAgent,
        subString : "iPod",
        identity : "iPod"
    }, {
        string : navigator.userAgent,
        subString : "Android",
        identity : "Android"
    }, {// Kindle Fire (Silk)
        string : navigator.userAgent,
        subString : "Silk",
        identity : "Kindle Fire"
    }, {
        string : navigator.userAgent,
        subString : "webOS",
        identity : "webOS"
    }, {
        string : navigator.userAgent,
        subString : "Mobile",
        identity : "Mobile"
    }, {
        string : navigator.platform,
        subString : "Linux",
        identity : "Linux"
    }]
};
TGE.BrowserDetect.init();

// iOS requires the viewport scale to be set to 1 before document load or the innerWidth/Height values go crazy
if (TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad") {
    var _vp = document.querySelector("meta[name=viewport]");
    _vp.setAttribute("content", "maximum-scale=1, minimum-scale=1, initial-scale=1, user-scalable=no");
}
/**
 * The Matrix class represents a 2D transformation matrix that determines how to map points from one coordinate space to another. These transformation functions include translation (x and y repositioning), rotation, scaling, and skewing.
 * @param {Number} a The value that affects the positioning of pixels along the x axis when scaling or rotating an image.
 * @param {Number} b The value that affects the positioning of pixels along the y axis when scaling or rotating an image.
 * @param {Number} c The value that affects the positioning of pixels along the x axis when rotating or skewing an image.
 * @param {Number} d The value that affects the positioning of pixels along the y axis when scaling or rotating an image.
 * @param {Number} tx The distance by which to translate each point along the x axis.
 * @param {Number} ty The distance by which to translate each point along the y axis.
 * @constructor
 */
TGE.Matrix = function(a, b, c, d, tx, ty) {
    a = typeof a !== 'undefined' ? a : 1;
    b = typeof b !== 'undefined' ? b : 0;
    c = typeof c !== 'undefined' ? c : 0;
    d = typeof d !== 'undefined' ? d : 1;
    tx = typeof tx !== 'undefined' ? tx : 0;
    ty = typeof ty !== 'undefined' ? ty : 0;

    this._internal = [a, c, tx, b, d, ty, 0, 0, 1];
}
/**
 * Creates a new Matrix object initialized as a rotation transformation using the specified angle in radians.
 * @param {Number} angle The angle of the desired rotation, in radians.
 * @return {TGE.Matrix} A new matrix object initialized to the desired rotation.
 */
TGE.Matrix.RotationMatrix = function(angleRadians) {
    var m = new TGE.Matrix();

    m._internal[0] = Math.cos(angleRadians);
    m._internal[1] = -Math.sin(angleRadians);
    m._internal[3] = Math.sin(angleRadians);
    m._internal[4] = Math.cos(angleRadians);

    return m;
}
/**
 * Creates a new Matrix object initialized as a scale transformation using the specified sx and sy values.
 * @param {Number} sx The desired horizontal scaling factor.
 * @param {Number} sy The desired vertical scaling factor.
 * @return {TGE.Matrix} A new matrix object initialized to the desired scaling factors.
 */
TGE.Matrix.ScaleMatrix = function(sx, sy) {
    return new TGE.Matrix().scale(sx, sy);
}
/**
 * Creates a new Matrix object initialized as a translation using the specified dx and dy values.
 * @param {Number} dx The desired horizontal displacement in pixels.
 * @param {Number} dy The desired vertical displacement in pixels.
 * @return {TGE.Matrix} A new matrix object initialized to the desired translation.
 */
TGE.Matrix.TranslationMatrix = function(dx, dy) {
    return new TGE.Matrix().translate(dx, dy);
}

TGE.Matrix.prototype = {
    _internal : null,

    /**
     * Sets each matrix property to a value that causes a null transformation. An object transformed by applying an identity matrix will be identical to the original.
     * After calling the identity() method, the resulting matrix has the following properties: a=1, b=0, c=0, d=1, tx=0, ty=0.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    identity : function() {
        var m = this._internal;
        m[1] = m[2] = m[3] = m[5] = m[6] = m[7] = 0;
        m[0] = m[4] = m[8] = 1;
        return this;
    },

    /**
     * Copies all of the matrix data from the source Matrix object into the calling Matrix object.
     * @param {TGE.Matrix} sourceMatrix The matrix from which to copy the data.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    copyFrom : function(sourceMatrix) {
        var m = this._internal;
        var sm = sourceMatrix._internal
        m[0] = sm[0];
        m[1] = sm[1];
        m[2] = sm[2];
        m[3] = sm[3];
        m[4] = sm[4];
        m[5] = sm[5];
        m[6] = sm[6];
        m[7] = sm[7];
        m[8] = sm[8];

        return this;
    },

    /**
     * Concatenates a matrix with the current matrix, effectively combining the geometric effects of the two. In mathematical terms, concatenating two matrices is the same as combining them using matrix multiplication.
     * This method replaces the source matrix with the concatenated matrix.
     * @param {TGE.Matrix} matrix2 The matrix object to concatenate with this one.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    // TODO - can we assume u,v,w parameters are always 0,0,1 and eliminate those calculations?
    concat : function(matrix2) {
        var m1 = this._internal;
        var m2 = matrix2._internal;
        var m00 = m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6];
        var m01 = m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7];
        var m02 = m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8];
        var m10 = m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6];
        var m11 = m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7];
        var m12 = m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8];
        var m20 = m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6];
        var m21 = m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7];
        var m22 = m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8];

        m1[0] = m00;
        m1[1] = m01;
        m1[2] = m02;
        m1[3] = m10;
        m1[4] = m11;
        m1[5] = m12;
        m1[6] = m20;
        m1[7] = m21;
        m1[8] = m22;

        return this;
    },

    /**
     * Applies a rotation transformation to this matrix object.
     * @param {Number} angle The angle to rotate in degrees.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    rotate : function(angle) {
        return this.concat(TGE.Matrix.RotationMatrix(angle * TGE.DEG2RAD));
    },

    /**
     * Applies a scaling transformation to the matrix. The x axis is multiplied by sx, and the y axis it is multiplied by sy.
     * @param {Number} sx The horizontal scaling factor.
     * @param {Number} sy The vertical scaling factor.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    scale : function(sx, sy) {
        var m = this._internal;
        m[0] *= sx;
        m[1] *= sy;
        m[3] *= sx;
        m[4] *= sy;
        return this;
    },

    /**
     * Translates the matrix along the x and y axes, as specified by the dx and dy parameters.
     * @param {Number} dx The desired horizontal translation, in pixels.
     * @param {Number} dy The desired vertical translation, in pixels.
     * @return {TGE.Matrix} This matrix object, modified by the operation.
     */
    translate : function(dx, dy) {
        this._internal[2] += dx;
        this._internal[5] += dy;
        return this;
    },

    /**
     * Transform a 2D point using this transformation matrix. Modifies the actual point object.
     * @param {TGE.Point} p The point to transform.
     * @return {TGE.Point} The original point object, transformed by this matrix.
     */
    transformPoint : function(p) {
        var x = p.x;
        var y = p.y;
        p.x = x * this._internal[0] + y * this._internal[1] + this._internal[2];
        p.y = x * this._internal[3] + y * this._internal[4] + this._internal[5];

        return p;
    }
}

/**
 * The Point object represents a location in a two-dimensional coordinate system, where x represents the horizontal axis and y represents the vertical axis.
 * @class
 * @property {Number} x The horizontal coordinate of the point.
 * @property {Number} y The vertical coordinate of the point.
 * @param {Number} x The horizontal coordinate.
 * @param {Number} y The vertical coordinate.
 * @constructor
 */
TGE.Point = function(x, y) {
    x = typeof x !== 'undefined' ? x : 0;
    y = typeof y !== 'undefined' ? y : 0;

    this.x = x;
    this.y = y;

    return this;
}

TGE.Point.prototype = {
    /**
     * Sets the members of Point to the specified values.
     * @param {Number} x The new x value for the point.
     * @param {Number} y The new y value for the point.
     */
    setTo : function(x, y) {
        this.x = x;
        this.y = y;
    },

    /**
     * Copies all of the point data from the source Point object into the calling Point object.
     * @param {TGE.Point} sourcePoint The Point object from which to copy the data.
     * @return {TGE.Point} This point object.
     */
    copyFrom : function(sourcePoint) {
        this.x = sourcePoint.x;
        this.y = sourcePoint.y;
        return this;
    },

    /**
     * Adds the coordinates of another point to the coordinates of this point to create a new point.
     * @param {TGE.Point} p The point to be added.
     * @return {TGE.Point} A new point set to the result of the calculation.
     */
    add : function(p) {
        return new this.constructor(this.x + p.x, this.y + p.y);
    },

    /**
     * Subtracts the coordinates of another point to the coordinates of this point to create a new point.
     * @param {TGE.Point} p The point to be subtracted.
     * @return {TGE.Point} A new point set to the result of the calculation.
     */
    subtract : function(p) {
        return new this.constructor(this.x - p.x, this.y - p.y);
    },

    /**
     * Offsets the Point object by the specified amount.
     * The value of dx is added to the original value of x to create the new x value.
     * The value of dy is added to the original value of y to create the new y value.
     * @param {Number} dx The amount by which to offset the horizontal coordinate, x.
     * @param {Number} dy The amount by which to offset the vertical coordinate, y.
     * @return {TGE.Point} This point object.
     */
    offset : function(dx, dy) {
        this.x += dx;
        this.y += dy;
        return this;
    },

    /**
     * Rotates the point around the origin to create a new point.
     * @param {Number} angle The angle in degrees to rotate the point by.
     * @return {TGE.Point} A new point set to the result of the rotation.
     */
    rotate : function(angle) {
        var r = angle * TGE.DEG2RAD;
        return new this.constructor(this.x * Math.cos(r) - this.y * Math.sin(r), this.y * Math.cos(r) + this.x * Math.sin(r));
    },

    /**
     * Modifies the value of this point by rotating it around the origin by the specified angle (in degrees).
     * @param {Number} angle The angle in degrees to rotate the point by.
     * @return {TGE.Point} This point object.
     */
    rotateThis : function(angle) {
        var r = angle * TGE.DEG2RAD;
        var x2 = this.x * Math.cos(r) - this.y * Math.sin(r);
        var y2 = this.y * Math.cos(r) + this.x * Math.sin(r);
        this.setTo(x2, y2);

        return this;
    }
}

/**
 * Provides a two dimensional vector for implementing Euclidean vector operations.
 * @class
 * @extends TGE.Point
 * @property {Number} x The horizontal coordinate of the vector.
 * @property {Number} y The vertical coordinate of the vector.
 * @param {Number} x The horizontal coordinate.
 * @param {Number} y The vertical coordinate.
 * @constructor
 */
TGE.Vector2D = function(x, y) {
    TGE.Vector2D.superclass.constructor.call(this, x, y);
}

TGE.Vector2D.prototype = {
    /**
     * Returns the length of the vector from the origin (0,0).
     * @return {Number} The magnitude of the vector.
     */
    magnitude : function() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    },

    /**
     * Returns the dot product of two vectors.
     * @param {TGE.Vector2D} v The vector to dot with this vector.
     * @return {Number} The dot product of the two vectors.
     */
    dotProduct : function(v) {
        return this.x * v.x + this.y * v.y;
    },

    /**
     * The cross product of 2D vectors results in a 3D vector with only a z component. This function returns the magnitude of the z value.
     * @param {TGE.Vector2D} v The vector to cross with this vector.
     * @return {Number} The magnitude of the z vector resulting from the cross product.
     */
    crossProduct : function(v) {
        return this.x * v.y - this.y * v.x;
    },

    /**
     * Calculates the angle between this vector object and the specified vector.
     * @param {TGE.Vector} v The vector to compare to this vector.
     * @return {Number} The angle between the two vectors in degrees.
     */
    angleBetween : function(v) {
        var mag = this.magnitude() * v.magnitude();
        if (mag === 0) {
            return 0;
        }

        return Math.acos(this.dotProduct(v) / mag) * TGE.RAD2DEG;
    }
}
extend(TGE.Vector2D, TGE.Point);

/**
 * A Rectangle object is an axis-aligned area defined by its position (as indicated by the top-left corner point) and by its width and its height.
 * @class
 * @property {Number} x The x coordinate of the top-left corner of the rectangle.
 * @property {Number} y The y coordinate of the top-left corner of the rectangle.
 * @property {Number} width The width of the rectangle, in pixels.
 * @property {Number} height The height of the rectangle, in pixels.
 * @param {Number} x The x coordinate of the top-left corner of the rectangle.
 * @param {Number} y The y coordinate of the top-left corner of the rectangle.
 * @param {Number} width The width of the rectangle, in pixels.
 * @param {Number} height The height of the rectangle, in pixels.
 * @constructor
 */
TGE.Rectangle = function(x, y, width, height) {
    x = typeof x !== 'undefined' ? x : 0;
    y = typeof y !== 'undefined' ? y : 0;
    width = typeof width !== 'undefined' ? width : 0;
    height = typeof height !== 'undefined' ? height : 0;

    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

TGE.Rectangle.prototype = {
    /**
     * Determines whether the rectangle specified in the toIntersect parameter intersects with this TGE.Rectangle object.
     * Note that TGE.Rectangle objects are always axis-aligned.
     * @param {TGE.Rectangle} toIntersect The TGE.Rectangle object to compare against this rectangle object.
     * @param {Number} [scaleFactor1=1] Percentage of this rectangle size to check against. Optional, 1 by default.
     * @param {Number} [scaleFactor2=1] Percentage of the toIntersect rectangle size to check against. Optional, 1 by default.
     * @return {Boolean} Whether or not the two rectangles intersect.
     */
    intersects : function(toIntersect, scaleFactor1, scaleFactor2) {
        scaleFactor1 = typeof scaleFactor1 === "undefined" ? 1 : scaleFactor1;
        scaleFactor2 = typeof scaleFactor2 === "undefined" ? 1 : scaleFactor2;

        var scaleFactorX = this.width * (1 - scaleFactor1) / 2;
        var scaleFactorY = this.height * (1 - scaleFactor1) / 2;
        var aminx = this.x + scaleFactorX;
        var aminy = this.y + scaleFactorY;
        var amaxx = this.x + this.width - scaleFactorX;
        var amaxy = this.y + this.height - scaleFactorY;

        scaleFactorX = toIntersect.width * (1 - scaleFactor2) / 2;
        scaleFactorY = toIntersect.height * (1 - scaleFactor2) / 2;
        var bminx = toIntersect.x + scaleFactorX;
        var bminy = toIntersect.y + scaleFactorY;
        var bmaxx = toIntersect.x + toIntersect.width - scaleFactorX;
        var bmaxy = toIntersect.y + toIntersect.height - scaleFactorY;

        if (bminx >= aminx && bmaxx <= amaxx && bminy >= aminy && bmaxy <= amaxy) {
            return true;
            // Inside
        }

        if ((amaxx < bminx || aminx > bmaxx) || (amaxy < bminy || aminy > bmaxy)) {
            return false;
            // Outside
        }

        return true;
        // Intersects
    },

    /**
     * Adds the rectangle specified in the toUnion parameter to this TGE.Rectangle object, by filling in the horizontal and vertical space between the two rectangles.
     * @param {TGE.Rectangle} toUnion The TGE.Rectangle object to add to this rectangle object.
     */
    union : function(toUnion) {
        var oldMaxX = this.x + this.width;
        var oldMaxY = this.y + this.height;
        var unionMaxX = toUnion.x + toUnion.width;
        var unionMaxY = toUnion.y + toUnion.height;

        this.x = Math.min(this.x, toUnion.x);
        this.y = Math.min(this.y, toUnion.y);

        var maxX = Math.max(oldMaxX, unionMaxX);
        var maxY = Math.max(oldMaxY, unionMaxY);

        this.width = maxX - this.x;
        this.height = maxY - this.y;
    }
}

/**
 * @constant
 */
TGE.PI = 3.1415926535;

/**
 * @constant
 */
TGE.TWO_PI = 6.2831853072;

/**
 * @constant
 */
TGE.RAD2DEG = 57.2957795;

/**
 * @constant
 */
TGE.DEG2RAD = 0.0174532925;

/**
 * @constant
 */
TGE.POSITIVE_X_VECTOR = new TGE.Vector2D(1, 0);

/**
 * @constant
 */
TGE.NEGATIVE_X_VECTOR = new TGE.Vector2D(-1, 0);

/**
 * @constant
 */
TGE.POSITIVE_Y_VECTOR = new TGE.Vector2D(0, 1);

/**
 * @constant
 */
TGE.NEGATIVE_Y_VECTOR = new TGE.Vector2D(0, -1);
/**
 * The DisplayObject class is the base class for all visual objects that can be placed on the stage.
 * The DisplayObject class supports basic functionality like the x and y position of an object, rotation, and scaling, as well as more advanced properties of the object such as its transformation matrix.
 * Typically you would not instantiate a TGE.DisplayObject directly - it would be more common to use {@link TGE.DisplayObjectContainer} or {@link TGE.Sprite}.
 * @property {Number} x Indicates the x coordinate of the display object relative to the local coordinates of the parent TGE.DisplayObjectContainer.
 * @property {Number} y Indicates the y coordinate of the display object relative to the local coordinates of the parent TGE.DisplayObjectContainer.
 * @property {Number} scaleX Indicates the horizontal scale percentage of the display object as applied from the registration point.
 * @property {Number} scaleY Indicates the vertical scale percentage of the display object as applied from the registration point.
 * @property {Number} rotation Indicates the rotation of the display object in degrees.
 * @property {Number} alpha Indicates the alpha transparency value of the display object (valid values are from 0-1).
 * @property {String} backgroundColor Specifies the background color of the display object's bounding area as a hex value string (ie: "#ff0000").
 * @property {Boolean} visible Whether or not the display object is visible.
 * @property {Number} width Indicates the width of the display object in pixels.
 * @property {Number} height Indicates the height of the display object in pixels.
 * @property {Number} registrationX Indicates the horizontal registration point for the display object as a percentage (ie: 0=far left, 0.5=center, 1=far right). Default is 0.5.
 * @property {Number} registrationY Indicates the vertical registration point for the display object as a percentage (ie: 0=top, 0.5=middle, 1=bottom). Default is 0.5.
 * @property {TGE.DisplayObjectContainer} parent Indicates the TGE.DisplayObjectContainer object that contains this display object as a child.
 * @property {TGE.Stage} stage The TGE.Stage instance that this display object is on.
 * @property {Boolean} mouseEnabled Determines whether or not the display object responds to mouse actions. Default is false.
 * @property {String} instanceName An optional name you can provide to the display object.
 * @constructor
 */
TGE.DisplayObject = function() {
    this.x = 0;
    this.y = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.rotation = 0;
    this.alpha = 1;
    this.backgroundColor = null;
    this.visible = true;
    this.width = 0;
    this.height = 0;
    this.registrationX = 0.5;
    this.registrationY = 0.5;
    this.parent = null;
    this.stage = null;
    this.mouseEnabled = false;
    this.instanceName = "";

    this._mLocalTransform = new TGE.Matrix();
    this._mLocalTransformNoReg = new TGE.Matrix();
    this._mWorldTransform = new TGE.Matrix();
    this._mWorldTransformNoReg = new TGE.Matrix();
    this._mRegistrationTransform = new TGE.Matrix();

    this._mTopLeft = new TGE.Point();
    this._mBottomRight = new TGE.Point();
    this._mAABB = new TGE.Rectangle();
    this._boundingInfoDirty = true;

    return this;
}

TGE.DisplayObject.prototype = {
    _mPreviousX : 0,
    _mPreviousY : 0,
    _mPreviousScaleX : 1,
    _mPreviousScaleY : 1,
    _mPreviousRotation : 0,
    _mPreviousRegistrationX : 0,
    _mPreviousRegistrationY : 0,
    _mPreviousVisibility : false,
    _mLocalTransform : null,
    _mLocalTransformNoReg : null,
    _mLocalTransformDirty : true,
    _mWorldTransform : null,
    _mWorldTransformNoReg : null,
    _mWorldTransformDirty : true,
    _mRegistrationTransform : null,
    _mTopLeft : 0,
    _mBottomRight : 0,
    _mAABB : null,
    _boundingInfoDirty : true,
    _mWorldAlpha : 1,
    _mIgnoreProperties : false,
    _mMouseOver : false,
    _visibilityChanged : false,

    /**
     * This function will manually set the local transformation matrix of the DisplayObject.
     * Using this function will cause the x, y, scaleX, scaleY, and rotation properties of the DisplayObject to be ignored.
     * They will also no longer be kept updated with the current display settings of the object.
     * @param {Number} a The value that affects the positioning of pixels along the x axis when scaling or rotating an image.
     * @param {Number} b The value that affects the positioning of pixels along the y axis when scaling or rotating an image.
     * @param {Number} c The value that affects the positioning of pixels along the x axis when rotating or skewing an image.
     * @param {Number} d The value that affects the positioning of pixels along the y axis when scaling or rotating an image.
     * @param {Number} tx The distance by which to translate each point along the x axis.
     * @param {Number} ty The distance by which to translate each point along the y axis.
     */
    setLocalTransform : function(a, b, c, d, tx, ty) {
        var m = this._mLocalTransform._internal;
        m[0] = a;
        m[1] = c;
        m[2] = tx;
        m[3] = b;
        m[4] = d;
        m[5] = ty;

        // Once this function has been used we stop building the local
        // transformation matrix using x, y, scale, rotation, etc.
        this._mIgnoreProperties = true;
        this._mLocalTransformDirty = true;
    },

    /**
     * This function can be called to undo the effect of calling setLocalTransform.
     * Calling this function will cause the x, y, scaleX, scaleY, and rotation properties to be used for generating the local transformation matrix again.
     */
    useDisplayProperties : function() {
        this._mIgnoreProperties = false;
        this._mLocalTransformDirty = true;
    },

    /**
     * Returns a rectangle that defines the axis-aligned boundary of the DisplayObject.
     * @return {TGE.Rectangle}
     */
    getBounds : function() {
        this._checkVisibilityChange();
        if (this._boundingInfoDirty) {
            this._updateAABB();
        }
        return this._mAABB;
    },

    /**
     * Evaluates the DisplayObject to see if it overlaps or intersects with the point specified by the x and y parameters.
     * @param {Number} x The x coordinate to test against this object.
     * @param {Number} y The y coordinate to test against this object.
     * @return {Boolean} True if the display object overlaps or intersects with the specified point; false otherwise.
     */
    hitTestPoint : function(x, y) {
        // TODO - this is wrong, doesn't account for parent, children, or transformations
        var x1 = this.x - (this.registrationX * this.width);
        var x2 = this.x + ((1 - this.registrationX) * this.width);
        var y1 = this.y - (this.registrationY * this.height);
        var y2 = this.y + ((1 - this.registrationY) * this.height);

        return (x > this.x - (this.registrationX * this.width)) && (x < this.x + ((1 - this.registrationX) * this.width)) && (y > this.y - (this.registrationY * this.height)) && (y < this.y + ((1 - this.registrationY) * this.height));
    },

    /**
     * @ignore Implemented by TGE.DisplayObjectContainer
     */
    clearChildren : function() {
        // Implemented by TGE.DisplayObjectContainer
    },

    /**
     * @ignore Implemented by TGE.ScreenEntity
     */
    markForRemoval : function() {
        // Implemented by TGE.ScreenEntity
    },

    /**
     * Provides the number of children of this object, and optionally all children's children as well.
     * @param {Boolean} recursive Whether or not to recursively count children (ie: children's children)
     * @return {Number} The number of children of this object.
     */
    numChildren : function(recursive) {
        return 0;
    },

    /**
     * Returns whether or not the mouse is currently over the object. This method will always return false unless this.mouseEnabled is set to true.
     * @return {Boolean}
     */
    isMouseOver : function() {
        return this._mMouseOver;
    },

    /**
     * @ignore
     */
    _draw : function(canvasContext) {
        this._checkVisibilityChange();
        if (!this.visible) {
            return;
        }

        // Update this object transform (necessary before drawing children)
        this._updateTransformations();

        // Add it to the collection of mouse targets if it is mouseEnabled and visible
        if (this.stage !== null && this.mouseEnabled) {
            this.stage._mMouseTargets.push(this);
        }

        // Push the drawing state
        canvasContext.save();

        // Apply the object's transformation to the canvas context
        var m = this._mWorldTransform._internal;
        if (this._mIgnoreProperties || this.rotation !== 0) {
            // Use sub-pixel positioning
            canvasContext.setTransform(m[0], m[3], m[1], m[4], m[2], m[5]);
        } else {
            // Lock the position to exact pixel coordinates
            canvasContext.setTransform(m[0], m[3], m[1], m[4], m[2] | 0, m[5] | 0);
        }

        // Set the alpha for the object
        canvasContext.globalAlpha = this._mWorldAlpha;

        // Draw the background fill if there is one
        if (this.backgroundColor !== null) {
            canvasContext.fillStyle = this.backgroundColor;
            canvasContext.fillRect(0, 0, this.width, this.height);
        }

        // Do the subclass specific drawing
        this._drawClass(canvasContext);

        // Restore the drawing state
        canvasContext.restore();
    },

    /**
     * @ignore
     */
    _drawClass : function(canvasContext) {
        // Nothing to do here
    },

    /**
     * @ignore
     */
    _updateTransformations : function() {
        // Determine if the object's local transformation matrix needs to be updated
        this._mWorldTransformDirty = false;
        var propertiesChanged = this.x !== this._mPreviousX || this.y !== this._mPreviousY || this.scaleX !== this._mPreviousScaleX || this.scaleY !== this._mPreviousScaleY || this.rotation !== this._mPreviousRotation || this._visibilityChanged;

        if (propertiesChanged && !this._mIgnoreProperties) {
            this._visibilityChanged = false;
            this._mPreviousX = this.x;
            this._mPreviousY = this.y;
            this._mPreviousScaleX = this.scaleX;
            this._mPreviousScaleY = this.scaleY;
            this._mPreviousRotation = this.rotation;
            this._mLocalTransformDirty = true;
        }

        // Do we need to update the registration point transformation matrix?
        if (this.registrationX !== this._mPreviousRegistrationX || this.registrationY !== this._mPreviousRegistrationY) {
            this._mPreviousRegistrationX = this.registrationX;
            this._mPreviousRegistrationY = this.registrationY;
            var offsetX = -this.width * this.registrationX;
            var offsetY = -this.height * this.registrationY;
            this._mRegistrationTransform.identity();
            this._mRegistrationTransform.translate(offsetX, offsetY);
        }

        // Do we need to update the local transform?
        if (this._mLocalTransformDirty) {
            if (!this._mIgnoreProperties) {
                this._mLocalTransform.identity();
                var m = this._mLocalTransform._internal;

                // Apply the translation
                m[2] = this.x;
                m[5] = this.y;

                // Apply the rotation (if any)
                if (this.rotation !== 0) {
                    this._mLocalTransform.rotate(this.rotation);
                }

                // Apply the scale (if any)
                if (this.scaleX !== 1 || this.scaleY !== 1) {
                    m[0] *= this.scaleX;
                    m[1] *= this.scaleY;
                    m[3] *= this.scaleX;
                    m[4] *= this.scaleY;
                }
            }

            // We need to account for the registration point
            this._mLocalTransformNoReg.copyFrom(this._mLocalTransform);
            this._mLocalTransform.concat(this._mRegistrationTransform);
        }

        // Apply the parent's transformation if it has been updated
        if (this.parent !== null) {
            if (this._mLocalTransformDirty || this.parent._mWorldTransformDirty) {
                this._mWorldTransform.copyFrom(this.parent._mWorldTransformNoReg);
                this._mWorldTransform.concat(this._mLocalTransform);
                this._mWorldTransformNoReg.copyFrom(this.parent._mWorldTransformNoReg)
                this._mWorldTransformNoReg.concat(this._mLocalTransformNoReg);
                this._mWorldTransformDirty = true;
            }
        } else {
            this._mWorldTransform.copyFrom(this._mLocalTransform);
            this._mWorldTransformDirty = this._mLocalTransformDirty;
        }

        // Update bounding info if required
        if (this._mWorldTransformDirty) {
            this._setBoundingInfoDirty();
        }

        // Set the cumulative alpha for the object
        this._mWorldAlpha = this.parent !== null ? this.parent._mWorldAlpha * this.alpha : this.alpha;

        // Don't need to update again until things change
        this._mLocalTransformDirty = false;
    },

    /**
     * @ignore
     */
    _updateAABB : function() {
        // Update the local bound extents
        this._mTopLeft.x = 0;
        this._mTopLeft.y = 0;
        this._mBottomRight.x = this.width;
        this._mBottomRight.y = this.height;

        // Transform the points into world space
        this._mWorldTransform.transformPoint(this._mTopLeft);
        this._mWorldTransform.transformPoint(this._mBottomRight);

        // Update the AABB
        var minX = Math.min(this._mTopLeft.x, this._mBottomRight.x);
        var maxX = Math.max(this._mTopLeft.x, this._mBottomRight.x);
        var minY = Math.min(this._mTopLeft.y, this._mBottomRight.y);
        var maxY = Math.max(this._mTopLeft.y, this._mBottomRight.y);

        this._mAABB.x = minX;
        this._mAABB.y = minY;
        this._mAABB.width = maxX - minX;
        this._mAABB.height = maxY - minY;

        this._boundingInfoDirty = false;
    },

    /**
     * @ignore
     */
    _setBoundingInfoDirty : function() {
        this._boundingInfoDirty = true;
        if (this.parent !== null) {
            this.parent._setBoundingInfoDirty();
        }
    },

    /**
     * @ignore
     */
    _checkVisibilityChange : function() {
        // Check if visibility changed, as that will required bounding info updates
        if (this.visible !== this._mPreviousVisibility) {
            this._visibilityChanged = true;
            this._mPreviousVisibility = this.visible;
            this._setBoundingInfoDirty();
        }
    }
}/**
 <p>The DisplayObjectContainer class is a base class for all display objects that can contain child objects.</p>
 <a href='http://jsbin.com/acaviy/1/edit'>View a working sample with full source code...</a>

 * @class
 * @extends TGE.DisplayObject
 * @constructor
 */
TGE.DisplayObjectContainer = function() {
    TGE.DisplayObjectContainer.superclass.constructor.call(this);

    this._mChildren = [];

    return this;
}

TGE.DisplayObjectContainer.prototype = {
    _mChildren : null,

    /**
     * Adds a child DisplayObject instance to this DisplayObjectContainer.
     * The child is added on top of all other children in this DisplayObjectContainer.
     * @param {TGE.DisplayObject} child The DisplayObject instance to add as a child of this DisplayObjectContainer instance.
     * @return {TGE.DisplayObject} The same DisplayObject instance passed in as the child parameter.
     */
    addChild : function(child) {
        // If this object is already a child, remove it from the current parent
        if (child.parent !== null) {
            child.parent.removeChild(child);
        }

        child.parent = this;
        child.stage = this.stage;
        this._mChildren.push(child);

        return child;
    },

    /**
     * Returns the child display object instance that exists at the specified index.
     * @param {Number} index The 0-indexed position of the child object.
     * @return {TGE.DisplayObject} The child display object at the specified index position.
     */
    getChildAt : function(i) {
        return this._mChildren[i];
    },

    /**
     * Returns the child display object that exists with the specified name. If more that one child display object has the specified name, the method returns the first matching object found.
     * @param {String} name The instance name to search for.
     * @param {Boolean} [recursive=false] Whether or not to search children's children for the object.
     * @return {TGE.DisplayObject|null} The first object found with the specified instance name, else null.
     */
    getChildByName : function(name, recursive) {
        recursive = typeof recursive === "undefined" ? false : recursive;

        var len = this._mChildren.length;
        for (var i = 0; i < len; i++) {
            // Is it this child?
            if (this._mChildren[i].instanceName === name) {
                return this._mChildren[i];
            }

            // Check this child's children
            if (recursive) {
                var obj = this._mChildren[i].getChildByName(name, true);
                if (obj !== null) {
                    return obj;
                }
            }
        }

        return null;
    },

    /**
     * Searches for the specified DisplayObject in the children array using strict equality (===) and returns the index position of the child.
     * @param {TGE.DisplayObject} child The child object to find.
     * @return {Number} The index of the child object in the children array, or -1 if not found.
     */
    getChildIndex : function(child) {
        var len = this._mChildren.length;
        for (var i = 0; i < len; i++) {
            if (this._mChildren[i] === child) {
                return i;
            }
        }

        return -1;
    },

    /**
     * Removes the specified child DisplayObject instance from the child list of the DisplayObjectContainer instance.
     * @param {TGE.DisplayObject} child The DisplayObject instance to remove.
     * @return {TGE.DisplayObject} The DisplayObject object that was removed.
     */
    removeChild : function(child) {
        var i = this.getChildIndex(child);
        if (i !== -1) {
            this._mChildren[i].parent = null;
            this._mChildren.splice(i, 1);
        }

        return child;
    },

    /**
     * Removes all the children from this DisplayObjectContainer instance.
     */
    clearChildren : function() {
        for (var i = this._mChildren.length - 1; i >= 0; i--) {
            this._mChildren[i].markForRemoval();
            this._mChildren[i].clearChildren();
            this._mChildren[i].parent = null;
            this._mChildren.splice(i, 1);
        }
        this._mChildren = [];
    },

    /**
     * Provides the number of children of this object, and optionally all children's children as well.
     * @param {Boolean} [recursive=false] Whether or not to recursively count children (ie: children's children)
     * @return {Number} The number of children this object has.
     */
    numChildren : function(recursive) {
        recursive = typeof recursive === "undefined" ? false : recursive;
        var numChildren = this._mChildren.length;

        if (recursive) {
            var totalChildren = 0;
            for (var i = 0; i < numChildren; i++) {
                totalChildren += 1 + this._mChildren[i].numChildren(true);
            }
            return totalChildren;
        }

        return numChildren;
    },

    /**
     * @ignore
     */
    _drawClass : function(canvasContext) {
        // First draw this object
        TGE.DisplayObjectContainer.superclass._drawClass.call(this, canvasContext);

        // Now draw the children
        var len = this._mChildren.length;
        for (var i = 0; i < len; i++) {
            var child = this._mChildren[i];

            // Even if a child is not visible we want to check if its visibility state has changed,
            // so that we can mark it as requiring a transformations update when it becomes visible again
            child._checkVisibilityChange();

            // If visible, draw the child
            if (child.visible) {
                canvasContext.save();
                child._draw(canvasContext);
                canvasContext.restore();
            }
        }
    },

    /**
     * @ignore
     */
    _updateAABB : function() {
        // Update this object's AABB
        TGE.DisplayObjectContainer.superclass._updateAABB.call(this);

        // Now merge in any children
        var len = this._mChildren.length;
        for (var i = 0; i < len; i++) {
            if (this._mChildren[i].visible) {
                this._mAABB.union(this._mChildren[i].getBounds());
            }
        }
    }
}
extend(TGE.DisplayObjectContainer, TGE.DisplayObject);
/**
 <p>The Stage class represents the main drawing area.
 It inherits from {@link TGE.DisplayObjectContainer}, which allows you to add child objects using the addChild method.
 To redraw the contents of the stage you must make a call to {@link TGE.Stage.draw}.</p>
 <p>If your game is built off of the {@link TGE.Game} class you do not need to manually manage or draw a stage object as this is done for you by {@link TGE.Game}.</p>
 <a href='http://jsbin.com/ozihey/5/edit'>View a working sample with full source code...</a>

 * @class
 * @param {HTMLDivElement} canvasDiv The div element to be used as the canvas rendering context.
 * @extends TGE.DisplayObjectContainer
 * @constructor
 */
TGE.Stage = function(canvasDiv) {
    TGE.Stage.superclass.constructor.call(this);

    this.stage = this;

    // Make sure we have a valid canvas regardless of what type of div was passed in
    var isCanvas = false;
    if (canvasDiv) {
        if ( canvasDiv instanceof HTMLDivElement) {
            isCanvas = false;
        } else if ( canvasDiv instanceof HTMLCanvasElement) {
            isCanvas = true;
        } else {
            canvasDiv = document.body;
        }
    }

    var actualCanvas;
    if (isCanvas) {
        actualCanvas = canvasDiv;
    } else {
        actualCanvas = document.createElement('canvas');
        canvasDiv.appendChild(actualCanvas);
    }

    this.width = canvasDiv.clientWidth;
    this.height = canvasDiv.clientHeight;
    this.registrationX = 0;
    this.registrationY = 0;

    // Set the size of the actual canvas to the size of the div that was passed in
    actualCanvas.width = this.width;
    actualCanvas.height = this.height;

    // Get the canvas context
    this._mCanvasContext = actualCanvas.getContext('2d');

    return this;
}

TGE.Stage.prototype = {
    _mCanvasContext : null,
    _mMouseTargets : [],

    /**
     * Tells the stage to draw all of its visible children. The background will only be cleared if the backgroundColor property has been set to a color.
     */
    draw : function() {
        // While we draw the scene, we'll also gather objects that need to be tested against mouse events.
        // They'll get added to the array in bottom to top order.
        this._mMouseTargets = [];

        this._mCanvasContext.globalAlpha = 1;
        this._mCanvasContext.globalCompositeOperation = 'source-over';

        // Draw the scene
        this._draw.call(this, this._mCanvasContext);
    },

    /**
     * @ignore
     */
    _notifyObjectsOfMouseEvent : function(event, mouseX, mouseY) {
        // Loop through the mouse targets from front to back (reverse order of the array)
        for (var i = this._mMouseTargets.length - 1; i >= 0; i--) {
            var dispObj = this._mMouseTargets[i];

            // First do a quick axis-aligned bounding box test
            if (dispObj.hitTestPoint(mouseX, mouseY)) {
                // Now do a more precise oriented bounding box check
                if (true) {
                    switch(event) {
                        case "up":
                            dispObj.MouseUp();
                            break;
                        case "down":
                            dispObj.MouseDown();
                            break;
                        case "click":
                            dispObj.Click();
                            break;
                    }

                    // This object will block the event from continuing to any object beneath it
                    return;
                }
            }
        }
    },

    /**
     * @ignore
     */
    _updateObjectMouseOverStates : function(mouseX, mouseY) {
        // Loop through the mouse targets from front to back (reverse order of the array)
        for (var i = this._mMouseTargets.length - 1; i >= 0; i--) {
            var dispObj = this._mMouseTargets[i];

            var mouseOver = dispObj.hitTestPoint(mouseX, mouseY);
            if (mouseOver) {
                dispObj._mMouseOver = true;
                //dispObj.MouseOver();
            } else if (dispObj._mMouseOver) {
                dispObj._mMouseOver = false;
                //dispObj.MouseLeave();
            }
        }
    }
}
extend(TGE.Stage, TGE.DisplayObjectContainer);
/**
 <p>The Sprite class is a display object that can be represented by an image, and can also contain children.</p>

 * @class
 * @extends TGE.DisplayObjectContainer
 * @constructor
 */
TGE.Sprite = function() {
    TGE.Sprite.superclass.constructor.call(this);

    return this;
}

TGE.Sprite.prototype = {
    _mImage : null,
    _mCellWidth : 0,
    _mCellHeight : 0,
    _mSpriteIndex : 0,
    _mCoordinateCache : null,

    /**
     * Assigns the specified image to the sprite object. The image can be a "sprite sheet" comprised of equally sized cells that can be specified for drawing using the setSpriteIndex function.
     * @param {String|HTMLImageElement} image An image id string indicating the desired image to load from the {@link TGE.AssetManager} singleton, or an HTMLImageElement to use directly.
     * @param {Number} [rows=1] The number of rows in the sprite sheet, or default of 1 if this is a single image.
     * @param {Number} [columns=1] The number of columns in the sprite sheet, or default of 1 if this is a single image.
     * @see TGE.Sprite#setSpriteIndex
     */
    setImage : function(image, rows, columns) {
        rows = typeof rows === "undefined" ? 1 : rows;
        columns = typeof columns === "undefined" ? 1 : columns;

        // Is the image specified an actual image asset or the id string?
        if ( typeof image === "string") {
            image = TGE.AssetManager.GetImage(image);
        }

        // Try loading it as an image asset
        if ( image instanceof Image) {
            this._mImage = image;
            this._mCellWidth = Math.floor(image.width / columns);
            this._mCellHeight = Math.floor(image.height / rows);
            this._mCoordinateCache = [];

            var tx, ty;
            for (var i = 0; i < rows * columns; i++) {
                tx = ((i % columns) | 0) * this._mCellWidth;
                ty = ((i / columns) | 0) * this._mCellHeight;
                this._mCoordinateCache.push([tx, ty]);
            }

            //this.width = Math.round(this._mCellWidth);
            //this.height = Math.round(this._mCellHeight);
            this.width = this._mCellWidth;
            this.height = this._mCellHeight;
        } else {
            this._mImage = null;
        }

        this._mSpriteIndex = 0;
    },

    /**
     * Indicates which cell of the image to use for drawing. Only applicable if the image is a sprite sheet.
     * @param {Number} index A zero-indexed number indicating which cell of the sprite sheet to use for drawing.
     */
    setSpriteIndex : function(index) {
        this._mSpriteIndex = index;

        // Error check
        if (this._mSpriteIndex >= this._mCoordinateCache.length) {
            TGE.log("***** ERROR: Attempt to call TGE.Sprite.setSpriteIndex with an out of range index (" + index.toString() + ")");
            this._mSpriteIndex = 0;
        }
    },

    /**
     * @ignore
     */
    _drawClass : function(canvasContext) {
        // Make sure the width wasn't modified - it must stay the same as the image size
        if (this._mImage !== null && (this.width !== this._mCellWidth || this.height !== this._mCellHeight)) {
            TGE.log("***** ERROR: You cannot change the width or height properties of a TGE.Sprite object - use scaleX or scaleY instead");
            this.width = this._mCellWidth;
            this.height = this._mCellHeight;
        }

        // Draw the image on the canvas
        if (this._mImage !== null) {
            canvasContext.drawImage(this._mImage, this._mCoordinateCache[this._mSpriteIndex][0] >> 0, this._mCoordinateCache[this._mSpriteIndex][1] >> 0, this.width, this.height, 0, 0, this.width, this.height);
        }

        // Do the DisplayObjectContainer drawing
        TGE.Sprite.superclass._drawClass.call(this, canvasContext);
    }
}
extend(TGE.Sprite, TGE.DisplayObjectContainer);
/** @ignore */
TGE.AudioLoader = function(id, url, url2, tags, priority) {
    var self = this;
    this.id = id;
    this.loader = null;
    this.forceHandler = null;

    this.audio = document.createElement('audio');
    this.audio.setAttribute('preload', 'auto');
    document.body.appendChild(this.audio);

    // Assume both url are present and one of them is an mp3
    if (TGE.BrowserDetect.browser === "Safari") {
        if ( typeof url !== "undefined") {
            if (url2.lastIndexOf('mp3') == url2.length - 'mp3'.length) {
                var tempUrl = url;
                url = url2;
                url2 = tempUrl;
            }
        }
    }

    var source = document.createElement('source');
    source.setAttribute('src', url);
    this.audio.appendChild(source);

    var source2 = document.createElement('source');
    source2.setAttribute('src', url2);
    this.audio.appendChild(source2);
    this.url = url;

    // used by the loader to categorize and prioritize
    this.tags = tags;
    this.priority = priority;
    this.complete = false;
    this.pollCount = 0;

    // called by PxLoader to trigger download
    this.start = function(pxLoader) {
        // we need the loader ref so we can notify upon completion
        this.loader = pxLoader;
        if (this.isLimited()) {
            // iOS does not preload, so the only way to preload is to play the audio file
            // set an event to fire as soon as play starts and pause the audio immediately
            var force1 = function() {
                this.audio.pause();
                this.audio.removeEventListener('play', this.forceHandler, false);
                this.complete = true;
                this.loader.onLoad(self);
                // the loader now knows that the audio is loaded. continue playing the file.
                this.audio.play();
            };

            this.forceHandler = force1.bind(this);
            this.audio.addEventListener('play', this.forceHandler, false);
            this.audio.play();
        } else {
            // for all other platforms, start downloading
            var force2 = function() {
                this.audio.removeEventListener('loadedmetadata', this.forceHandler, false);
                this.complete = true;
                this.loader.onLoad(self);
            };

            this.forceHandler = force2.bind(this);
            this.audio.addEventListener("loadedmetadata", this.forceHandler, false);
            this.audio.load();
        }
    };

    // called by PxLoader to check status of image (fallback in case
    // the event listeners are not triggered).
    this.checkStatus = function() {
        // report any status changes to the loader
        // no need to do anything if nothing has changed
        if (this.audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
            this.loader.onError(self);
            return;
        }

        if (this.pollCount >= 5) {
            this.loader.onTimeout(self);
            return;
        }

        if (this.complete === true) {
            this.loader.onLoad(self);
        }

        // on iOS devices, loading will not happen until a click occurs, this will eventually timeout.
        // So force it timeout right away. on play after a click force the onLoad again
        if (this.isLimited()) {
            this.loader.onTimeout(self);
            return;
        }

        this.pollCount++;
    };

    // called by PxLoader when it is no longer waiting
    this.onTimeout = function() {
        // must report a status to the loader: load, error, or timeout
        this.loader.onTimeout(self);
    };

    // returns a name for the resource that can be used in logging
    this.getName = function() {
        return url;
    }
}
/** @ignore */
// Returns true if we are working with limited audio functionality, like on iOS
TGE.AudioLoader.prototype.isLimited = function() {
    return (TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad");
}
// This function used internally by PxLoader
/** @ignore */
PxLoader.prototype.addAudio = function(id, url1, url2, tags, priority) {
    var soundLoader = new TGE.AudioLoader(id, url1, url2, tags, priority);
    this.add(soundLoader);
    return soundLoader.audio;
};
/**

 * @class AudioManager is a singleton class that implements all functionality related to audio files, including playing, pausing, resuming, sprites, etc

 * It is available to the game as

 * <GameObject>.audioManager ;

 * @constructor

 */

TGE.AudioManager = function(assetManager) {

    this.mAssetManager = assetManager;

    this.mVolume = 1.0;

    this.mMuted = false;

    this.mplayerManagerList = new Array();

}

TGE.AudioManager.prototype = {

    /**

     * used for playerManager the audio

     * @param config {JSON} this can contain the following params

     *	   config = {

     *				id:'chomp', // resource id specified when  asset was loaded

     *				loop:false,  // the values can be

     *				              true - to play it in loop

     *							  false - to play it once

     *				callBackFunction : callBackHandler // callback handler

     *			   }

     */

    Play : function(config) {

        var playerManager = null;

        if (config.id in this.mplayerManagerList) {

            playerManager = this.mplayerManagerList[config.id];

        } else {

            playerManager = new TGE.PlayerManager(this);

            if (playerManager.init(config) === false) {

                return;

            }

            this.mplayerManagerList[config.id] = playerManager;

        }

        if (this.isMobile() == true && this.mMuted === true)

            return;

        playerManager.playAudio(config);

    },

    /**

     * This function Pauses the audio

     * @param resourceURL {String} Resource ID of the audio-file

     */

    Pause : function(resourceURL) {

        if ( resourceURL in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[resourceURL];

            playerManager.pauseAudio();

        }

    },

    /**

     * This function mutes all currently playing audio

     */

    Mute : function() {

        if (this.mMuted === true) {

            return;

        }

        this.mMuted = true;

        for (var id in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[id];

            if (this.isMobile() === true) {

                if (playerManager.nLoop == 0)

                    playerManager.stopAudio();
                
else

                    playerManager.pauseAudio();

            } else

                playerManager.muteAudio();

        }

    },

    /**

     * This function unmutes the audio

     */

    Unmute : function() {

        if (this.mMuted === false) {

            return;

        }

        this.mMuted = false;

        for (var id in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[id];

            if (this.isMobile() === true) {

                if (playerManager.nLoop != 0) {

                    if (playerManager.mState === playerManager.STATE.Stopped)

                        playerManager.playAudio({});
                    
else

                        playerManager.resumeAudio();

                }

            } else

                playerManager.unmuteAudio();

        }

    },

    /**

     * This function toggles the mute status.

     */

    ToggleMute : function() {

        if (this.mMuted === true) {

            this.Unmute();

        } else {

            this.Mute();

        }

    },

    /**

     * This function stop all playerManager Audio

     */

    StopAll : function() {

        for (var id in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[id];

            playerManager.stopAudio();

        }

    },

    /**

     * This function pausing all playerManager Audio. On click of resume the audio file will start playerManager from where it had stopped

     */

    PauseAll : function() {

        for (var id in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[id];

            playerManager.pauseAudio();

        }

    },

    /**

     * This function resume playerManager Audio.

     */

    ResumeAll : function() {

        for (var id in this.mplayerManagerList) {

            var playerManager = this.mplayerManagerList[id];

            if (this.isMobile() == true && this.mMuted === true)

                continue;

            playerManager.resumeAudio();

        }

    },

    isLoadAudio : function() {

        return this.mAssetManager.mLoadAudio;

    },

    isMobile : function() {

        return (TGE.BrowserDetect.platform !== "Windows" && TGE.BrowserDetect.platform !== "Mac");

    }
}

/* This class is internally used by AudioManger */

/** @ignore */

TGE.PlayerManager = function(audioManager) {

    this.mAudioManager = audioManager;

    this.nStartTime = 0;

    this.nEndTime = -1;

    this.nLoop = 0;

    this.callback = null;

    this.audioElement = null;

    this.bPlaySegment = false;

    this.STATE = {
        NotLoaded : 0,
        Playing : 1,
        Stopped : 2,
        Paused : 3,
        AutoPaused : 4
    };

    this.mState = this.STATE.NotLoaded;

    this.audioId = null;

    this.audioPlaybackInProgressHandler = null;

    this.audioPlaybackCompleteHandler = null;

}

TGE.PlayerManager.prototype = {

    /* This function is internally used by AudioManager */

    /** @ignore */

    init : function(config) {

        this.mState = this.STATE.NotLoaded;

        this.audioId = config.id;

        var that = this;

        this.callback = (config.callBackFunction !== undefined ? config.callBackFunction : null);

        this.audioElement = this.mAudioManager.mAssetManager.getImage(config.id);

        if (undefined === this.audioElement) {

            TGE.log("Unknown audio id: " + config.id);

            return false;

        }

        // initialization

        this.nStartTime = 0;

        this.nEndTime = -1;

        if ("audio_sprite" === this.audioElement.assetType) {

            this.bPlaySegment = true;

            this.nStartTime = this.audioElement.startTime;

            this.nEndTime = this.audioElement.endTime;

            this.audioElement = this.mAudioManager.mAssetManager.getImage(this.audioElement.id);

        }

        if (this.audioElement.canPlayType) {

        } else {

            TGE.log("No canPlayType attribute found in audio tag: " + config.id);

            return false;

        }

        this.nLoop = 0;

        if (config.loop !== undefined) {

            this.nLoop = Number(config.loop);

        }

        if (this.nLoop === undefined) {

            this.nLoop = 0;

        }

        var audioPlaybackInProgress = function() {

            if (this.bPlaySegment) {

                if (this.audioElement.currentTime < this.nStartTime) {

                    this.audioElement.currentTime = this.nStartTime;

                }

                if (this.audioElement.currentTime >= this.nEndTime) {

                    if (this.nLoop === 0) {

                        this.stopAudio();

                    } else {

                        this.restartAudio();

                    }

                }

            }

        };

        var audioPlaybackComplete = function() {

            if (this.nLoop === 0) {

                this.stopAudio();

            } else {

                this.restartAudio();

            }

        };

        this.audioElement.addEventListener('timeupdate', audioPlaybackInProgress.bind(this), false);

        this.audioElement.addEventListener('ended', audioPlaybackComplete.bind(this), false);

        window.addEventListener('pagehide', function() {

            if (that.mState === that.STATE.Playing) {

                that.pauseAudio();

                that.mState = that.STATE.AutoPaused;

            }

        });

        window.addEventListener('pageshow', function() {

            if (that.mState === that.STATE.AutoPaused) {

                that.resumeAudio();

            }

        });

        this.mState = this.STATE.Stopped;

        return true;

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    playAudio : function(config) {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (this.mAudioManager.mMuted === true) {

            this.audioElement.volume = 0;

        } else {

            this.audioElement.volume = this.mAudioManager.mVolume;

        }

        try {

            this.audioElement.currentTime = this.nStartTime;

        } catch(e) {

            TGE.log("Error setting start time, continuing: " + e);

        }

        if (this.bPlaySegment === false) {

            this.nEndTime = this.audioElement.duration;

        }

        this.mState = this.STATE.Playing;

        this.audioElement.play();

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    stopAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        this.mState = this.STATE.Stopped;

        this.audioElement.pause();

        this.audioElement.currentTime = 0;

        if (this.callback !== null)

            this.callback();

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    restartAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        this.mState = this.STATE.Playing;

        this.audioElement.currentTime = this.nStartTime;

        this.audioElement.play();

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    pauseAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        if (this.mState !== this.STATE.Playing) {

            return;

        }

        this.mState = this.STATE.Paused;

        this.audioElement.pause();

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    resumeAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        if (this.mState !== this.STATE.Paused) {

            return;

        }

        this.mState = this.STATE.Playing;

        this.audioElement.play();

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    muteAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        this.audioElement.volume = 0;

    },

    /* This function is internally used by AudioManager */

    /** @ignore */

    unmuteAudio : function() {

        if (this.mAudioManager.isLoadAudio() === false)

            return;

        if (undefined === this.audioElement) {

            return;

        }

        this.audioElement.volume = this.mAudioManager.mVolume;

    },
}

/**
 * @class The core client-side game component: create a subclass of TGE.Game to define your own game.
 * @constructor
 */
TGE.Game = function() {
    this.analytics = null;

    // Document div's
    this.mCanvasDiv = null;
    this.mReorientationDiv = null;

    // Scene graph and rendering
    this.mCanvasPosition = null;
    this.mGameManager = new TGE.ObjectsManager();
    this.mLayers = {};
    this.mCameraLocation = null;

    // Loading & Assets
    this.mLoadingStartTime = new Date().getTime();
    this.mLoadingScreen = null;

    this.stage = null;
    this.assetManager = new TGE.AssetManager();
    this.audioManager = new TGE.AudioManager(this.assetManager);

    // Game state
    this.mPlaying = false;
    this.mPaused = false;
    this.mCurrentLevel = null;
    this.mPauseButton = null;
    this.mUserPauseEnabled = false;

    // Framerate and time tracking (code from: http://stackoverflow.com/questions/4787431/check-fps-in-js)
    this.mGameTime = 0;
    this.mFilterStrength = 10;
    this.mFrameTime = 0;
    this.mLastLoop = new Date;
    this.mLastDisplay = new Date;
    this.mThisLoop
    this.mFPSText = null;

    // Caps for update interval - set a minimum value to prevent your
    // simulation from processing too large an update in a single frame.
    // For realistic physics simulations that require a constant tick
    // time, set the min and max value to be the same.
    this.mMaxTickTime = 0.1;
    this.mMinTickTime = Number.MIN_VALUE;

    // UI
    this.mUIManager = new TGE.ObjectsManager();
    this.mScreenManager = new TGE.ScreenManager(this);

    // User input handling
    this.mMouseX = 0;
    this.mMouseY = 0;
    this.mMouseDown = false;
    this.mKeysDown = {};

    // Device specific handling
    this.mDefaultLinkTarget = "_blank";

    this.canvasWidth = 0;
    this.canvasHeight = 0;

    this._mNativeScaling = null;

    this._mViewportScale = 1;

    // Gather some platform info for easy access later
    this._oniOS = (TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad");
    this._onAndroid = (TGE.BrowserDetect.platform === "Android");
}

TGE.Game.prototype = {
    _mViewportScaleSet : false,
    _mViewportScale : 0,
    _miOSViewportScale : 0,
    _mResizeTimeout : null,
    _oniOS : false,
    _onAndroid : false,

    /**
     * Indicates whether or not the game is being played on a mobile device.
     * @return {Boolean} True if the game is being played on a mobile device, false otherwise.
     */
    onMobile : function() {
        return TGE.BrowserDetect.isMobileDevice;
    },

    /**
     * Indicates whether or not the game is being played on an iOS device.
     * @return {Boolean} True if the game is being played on an iOS device, false otherwise.
     */
    oniOS : function() {
        return this._oniOS;
    },

    /**
     * Indicates whether or not the game is being played on an Android device.
     * @return {Boolean} True if the game is being played on an Android device, false otherwise.
     */
    onAndroid : function() {
        return this._onAndroid;
    },

    /**
     * Indicates whether or not the game is being run as a native PhoneGap build.
     * @return {Boolean} True if the game is being run as a native PhoneGap build, false otherwise.
     */
    onPhoneGap : function() {
        return TGE.BrowserDetect.usingPhoneGap;
    },

    /**
     * Indicates whether the user's platform (device, OS, browser, etc.) is considered acceptable to play the game.
     * Treat this implementation of the function as an example and override it in your game subclass for customized behavior.
     * @return {Boolean} True if the user's platform is considered acceptable for playing the game, false otherwise.
     */
    IsPlatformAcceptable : function() {
        // The very first thing to check is 2D canvas support
        var canvas2DSupported = !!window.CanvasRenderingContext2D;
        // http://stackoverflow.com/questions/2745432/best-way-to-detect-that-html5-canvas-is-not-supported/2745459#2745459
        if (!canvas2DSupported) {
            // Send an analytic event
            this.AnalyticErrorEvent("no canvas");

            return false;
        }

        var bReturn = false;

        // iOS
        if (TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad") {
            // OS version
            var OSmajor = TGE.BrowserDetect.OSversion.charCodeAt(0) - 48;

            return OSmajor >= 5;
        }

        // Android
        if (TGE.BrowserDetect.Platform === "Android") {
            return true;
        }

        // Windows or Mac
        if (TGE.BrowserDetect.platform === "Windows" || TGE.BrowserDetect.platform === "Mac") {
            var browser = TGE.BrowserDetect.browser.toLowerCase();
            var version = parseFloat(TGE.BrowserDetect.version);

            if (browser == 'firefox') {
                return version >= 8;
            } else if (browser == 'explorer') {
                return version >= 9;
            } else if (browser == 'chrome') {
                return version >= 14;
            } else if (browser == 'safari') {
                return version >= 5.1;
            } else {
                // Just allow everything else?
                //bReturn = true;
            }
        }

        return true;
    },

    /**
     * Call this function if the position of the game canvas is ever moved. It is called automatically for browser resize events, but may be necessary to call manually if the canvas position is changed by other means.
     */
    _determineCanvasPosition : function() {
        TGE.debugLog("_determineCanvasPosition");
        this.mCanvasPosition = getElementPosition(this.mCanvasDiv);
    },

    /**
     * Launching point for the entire game. Calling this function will initialize the game environment and begin downloading required assets.
     * @param {Object} gameParameters Information about how the game should be setup.
     * @param {String} gameParameters.gameDiv ID of the game canvas div element.
     * @param {String} [gameParameters.orientation="unspecified"] The orientation the game is meant to be played in. Can be "portrait", "landscape", or "unspecified".
     * @param {String} [gameParameters.reorientDiv] ID of the div element to display if a users orients their device in a way that should pause the game and display an error message.
     * @return {Boolean} False if the game canvas could not be found.
     */
    Launch : function(gameParameters, arg2) {
        var gameDiv;
        var reorientDiv;
        var width = -1;
        var height = -1;
        var resizeForNative = false;

        // Hack to make sure games made w/0.3.2 and previous will work with current SDK versions
        if (this.analytics === null && this.mAnalytics != null) {
            this.analytics = this.mAnalytics;
        }

        // This is a hack for the 0.3.0 to 0.3.1 transition (we still want to support the 0.3.0 arguments for 0.3.0 demo games)
        if ( typeof gameParameters === "string") {
            gameDiv = gameParameters;
            reorientDiv = arg2;
        } else {
            gameDiv = typeof gameParameters.gameDiv === "undefined" ? null : gameParameters.gameDiv;
            reorientDiv = typeof gameParameters.reorientDiv === "undefined" ? null : gameParameters.reorientDiv;
            width = typeof gameParameters.width === "undefined" ? -1 : gameParameters.width;
            height = typeof gameParameters.height === "undefined" ? -1 : gameParameters.height;
            resizeForNative = typeof gameParameters.resizeForNative === "undefined" ? false : gameParameters.resizeForNative;
        }

        // Get the canvas div
        this.mCanvasDiv = document.getElementById(gameDiv);
        if (this.mCanvasDiv == null) {
            console.log("***** ERROR: Could not find canvas div '" + gameDiv + "'");
            return false;
        }

        if (resizeForNative) {
            var vpDiv = document.getElementById("viewporter");
            if (vpDiv !== null) {
                vpDiv.align = "left";
            }

            // These are all kind of hacked at the moment...
            var ratio = 1;
            if (TGE.BrowserDetect.platform === "iPad") {
                // Lock the width and increase the height to match native iPad aspect ratio
                ratio = 768 / 1024;
                width = this.mCanvasDiv.clientWidth;
                height = Math.round(ratio * width);
            } else if (TGE.BrowserDetect.platform === "iPhone") {
                // Lock the width and increase the height to match native iPhone aspect ratio
                ratio = 320 / 480;
                width = this.mCanvasDiv.clientWidth;
                height = Math.round(ratio * width);

                // iPhone 5?
                if (vpDiv !== null && (window.innerWidth > 480 || window.innerHeight > 480)) {
                    vpDiv.align = "center";
                }
            }

            if (ratio !== 1) {
                this._mNativeScaling = {
                    x : (width / this.mCanvasDiv.clientWidth),
                    y : (height / this.mCanvasDiv.clientHeight)
                };
            }
        }

        if (width > 0 && height > 0) {
            this.mCanvasDiv.style.width = width + "px";
            this.mCanvasDiv.style.height = height + "px";
        }

        this.canvasWidth = this.mCanvasDiv.clientWidth;
        this.canvasHeight = this.mCanvasDiv.clientHeight;

        // Resize the viewport for the device
        TGE.debugLog("game launch calling _resizeViewport");
        this._resizeViewport();

        // Get the div to show when the orientation is wrong
        this.mReorientationDiv = document.getElementById(reorientDiv);

        // Determine the position of the canvas for mouse events
        this._determineCanvasPosition();

        // Add the resize event for orientation and screen size changes
        window.addEventListener('resize', this._onResize.bind(this), false);

        // Add events to auto-pause the game when deactivated on mobile
        if (this.onMobile()) {
            window.addEventListener("blur", this._onDeactivate.bind(this), false);
            window.addEventListener("pagehide", this._onDeactivate.bind(this), false);
            if (this.onPhoneGap()) {
                document.addEventListener("pause", this._onDeactivate.bind(this), false);
            }
        }

        // Input handlers
        if ("ontouchstart" in document.documentElement && TGE.BrowserDetect.isMobileDevice) {
            this.mCanvasDiv.addEventListener("touchstart", this._mouseDown.bind(this), false);
            this.mCanvasDiv.addEventListener("touchmove", this._mouseMove.bind(this), false);
            this.mCanvasDiv.addEventListener("touchend", this._mouseUp.bind(this), false);
        } else {
            this.mCanvasDiv.addEventListener("click", this._preventBehavior.bind(this), false);
            this.mCanvasDiv.addEventListener("mousedown", this._mouseDown.bind(this), false);
            this.mCanvasDiv.addEventListener("mouseup", this._mouseUp.bind(this), false);
            this.mCanvasDiv.addEventListener("mousemove", this._mouseMove.bind(this), false);
        }

        // Keyboard events
        document.addEventListener("keydown", this._keyDown.bind(this), false);
        document.addEventListener("keyup", this._keyUp.bind(this), false);

        // Now we can initialize the renderer (do this before we setup the OrientationChanged callback!)
        this.InitializeRenderer();

        // Setup the callback for detecting orientation change events
        window.addEventListener("orientationchange", this._onOrientationChanged);
        viewporter.preventPageScroll = true;

        // Begin the asset loading process
        this.BeginLoad();

        return true;
    },

    _onOrientationChanged : function() {
        TGE.debugLog("_onOrientationChanged called");
        viewporter.refresh();
    },

    _onResize : function() {
        TGE.debugLog("_onResize::_mResizeTimeout: " + this._mResizeTimeout);

        // If a timeout is pending, cancel it
        if (this._mResizeTimeout !== null) {
            clearTimeout(this._mResizeTimeout);
            this._mResizeTimeout = null;
        }

        // Delay the handling of a resize (Android takes some time to sort itself out)
        if (this.onAndroid()) {
            this._mResizeTimeout = setTimeout(this._resizeViewport.bind(this), 500);
        } else {
            this._resizeViewport();
        }
    },

    _resizeViewport : function() {
        TGE.debugLog("_resizeViewport");

        var canvas = this.mCanvasDiv;
        var style = canvas.getAttribute('style') || '';

        var gameWidth = this.canvasWidth;
        var gameHeight = this.canvasHeight;
        var screenWidth = window.innerWidth;
        var screenHeight = window.innerHeight;

        // On PhoneGap we can use the raw screen dimensions since there is no browser chrome
        if (TGE.BrowserDetect.usingPhoneGap) {
            screenWidth = screen.width;
            screenHeight = screen.height;
        }

        if ((TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad") && this._mViewportScaleSet) {
            screenHeight *= this._miOSViewportScale;
            screenWidth *= this._miOSViewportScale;
        }

        TGE.debugLog("_resizeViewport::game size: " + gameWidth + "x" + gameHeight + ", \nscreen size: " + screenWidth + "x" + screenHeight);

        // Are we in the correct orientation?
        var portraitGame = gameWidth <= gameHeight;
        var portraitOrientation = screenWidth <= screenHeight;
        var correctOrientation = portraitOrientation === portraitGame;

        var scale = {
            x : 1,
            y : 1
        };
        scale.x = screenWidth / gameWidth;
        scale.y = screenHeight / gameHeight;

        // Round to 3 decimal places
        scale.x = Math.round(scale.x * 100) / 100;
        scale.y = Math.round(scale.y * 100) / 100;

        var finalScale = 1;
        var widthScaled;
        if (scale.x < scale.y) {
            finalScale = scale.x;
            widthScaled = true;
        } else {
            finalScale = scale.y;
            widthScaled = false;
        }

        // If it's close enough to 1:1 scale, prevent unnecessary scaling
        if (Math.abs(1 - finalScale) <= 0.01) {
            finalScale = 1;
        }

        // Every device is quirky in its own special way
        viewport = document.querySelector("meta[name=viewport]");
        var vpDiv = document.getElementById("viewporter");
        if (TGE.BrowserDetect.platform === "iPhone" || TGE.BrowserDetect.platform === "iPad") {
            // Don't use canvas scaling on iOS as it seems to kill the performance.

            // But wait - we have to if it's an oversized game on an iPhone 5! (discovered with Anubis - 960x561)
            if (screen.height > 480 && !portraitGame && (gameHeight / gameWidth) > (screen.width / screen.height)) {
                if (correctOrientation) {
                    this._miOSViewportScale = 1;
                    this._mViewportScale = finalScale;
                    scale = finalScale + ', ' + finalScale;
                    canvas.setAttribute('style', style + ' ' + '-ms-transform-origin: left top; -webkit-transform-origin: left top; -moz-transform-origin: left top; -o-transform-origin: left top; transform-origin: left top; -ms-transform: scale(' + scale + '); -webkit-transform: scale3d(' + scale + ', 1); -moz-transform: scale(' + scale + '); -o-transform: scale(' + scale + '); transform: scale(' + scale + ');');
                    this._mViewportScaleSet = true;

                    // Center the game (if a canvas xform was used for scaling, a margin buffer works better than align settings)
                    if (vpDiv !== null) {
                        var left = Math.round((screenWidth - (gameWidth * finalScale)) / 2);
                        vpDiv.style.marginLeft = left + "px";
                    }
                }
            } else {
                // Only apply scaling if we are in the correct orientation, otherwise the scaling will mess
                // with the innerWidth/Height values next time around
                if (correctOrientation) {
                    // The trick here is we only want to do this once. iOS will return different innerWidth/Height values
                    // after the meta viewport has been changed, so we need to get it right the first time
                    this._miOSViewportScale = finalScale;

                    //alert("Screen: " + screenWidth + "," + screenHeight + "\nGame: " + gameWidth + "," + gameHeight + "\nSCALE: " + finalScale);

                    //finalScale = this._miOSViewportScale;
                    viewport.setAttribute("content", "maximum-scale=" + finalScale + ", minimum-scale=" + finalScale + ", initial-scale=" + finalScale + ", user-scalable=no");

                    // Center the game vertically
                    if (vpDiv !== null) {
                        //alert("Screen: " + screenWidth + "," + screenHeight + "\nGame: " + gameWidth + "," + gameHeight + "\nSCALE: " + finalScale);
                        var top = Math.round((screenHeight - (gameHeight * finalScale)) / 2) + "px";
                        if (vpDiv.style.marginTop !== top) {
                            vpDiv.style.marginTop = top;
                        }
                    }

                    this._mViewportScaleSet = true;
                } else {
                    // Wrong orientation - just set to default so orientation message displays properly
                    viewport.setAttribute("content", "initial-scale=1 maximum-scale=1 user-scalable=0");
                }
            }
        } else if (TGE.BrowserDetect.platform === "Android" || TGE.BrowserDetect.platform === "Kindle Fire" || TGE.BrowserDetect.platform === "Mobile")// "Mobile" is likely Firefox OS
        {
            if (correctOrientation) {
                TGE.debugLog("_resizeViewport correct orientation");

                if (TGE.BrowserDetect.usingPhoneGap) {
                    TGE.debugLog("_resizeViewport using PhoneGap, _mViewportScaleSet: " + this._mViewportScaleSet);

                    // Don't set this more than once or its gets a little freaky
                    if (!this._mViewportScaleSet) {
                        var fakeDPI = Math.round(240 * (1 / finalScale));
                        var targetDensity = "target-densitydpi=" + fakeDPI;
                        viewport.setAttribute("content", targetDensity);
                        this._mViewportScaleSet = true;

                        TGE.debugLog("_resizeViewport usingPhoneGap::target density: " + targetDensity);
                        // alert("Target Density: "+targetDensity);
                    }
                }

                // High end Android or FF OS devices (Android 4.X and above, all browsers)
                else if (TGE.BrowserDetect.browser == "Chrome" || TGE.BrowserDetect.browser == "Firefox" || parseInt(TGE.BrowserDetect.OSversion.charAt(0)) >= 4) {
                    this._mViewportScale = finalScale;
                    scale = finalScale + ', ' + finalScale;
                    //alert("WI: " + window.innerWidth + "," + window.innerHeight + "\nC: " + gameWidth + "," + gameHeight + "\nSCALE: " + finalScale);
                    canvas.setAttribute('style', style + ' ' + '-ms-transform-origin: left top; -webkit-transform-origin: left top; -moz-transform-origin: left top; -o-transform-origin: left top; transform-origin: left top; -ms-transform: scale(' + scale + '); -webkit-transform: scale3d(' + scale + ', 1); -moz-transform: scale(' + scale + '); -o-transform: scale(' + scale + '); transform: scale(' + scale + ');');
                    this._mViewportScaleSet = true;

                    TGE.debugLog("_resizeViewport using High end devices (Android 4.X and above, all browsers)\nWI: " + window.innerWidth + "," + window.innerHeight + "\nC: " + gameWidth + "," + gameHeight + "\nSCALE: " + finalScale);
                } else// Assume Android 2.X or Kindle Fire
                {
                    TGE.debugLog("_resizeViewport Assume Android 2.X or Kindle Fire");

                    // Don't set this more than once or its gets a little freaky
                    if (!this._mViewportScaleSet) {
                        viewport.setAttribute("content", "target-densitydpi=device-dpi");
                        this._mViewportScaleSet = true;

                        TGE.debugLog("_resizeViewport using Android 2.X or Kindle Fire\ntarget-densitydpi=device-dpi");
                    }
                }

                // If the game is centered in portrait and scaled in width to fit,
                // it will cause blank space on the left side of the game (discovered in FF browser on Android)
                if (widthScaled && vpDiv !== null) {
                    vpDiv.align = "left";
                }
            } else {
                // Wrong orientation - just set to default so orientation message displays properly
                viewport.setAttribute("content", "initial-scale=1 maximum-scale=1 user-scalable=0");
            }

            // Center the game (if a canvas xform was used for scaling, a margin buffer works better than align settings)
            if (vpDiv !== null) {
                var left = Math.round((screenWidth - (gameWidth * finalScale)) / 2);
                vpDiv.style.marginLeft = left + "px";
            }
        } else {
            // Desktop or unknown configuration

            // Center the game
            if (vpDiv !== null) {
                vpDiv.align = "center";
            }
        }

        if (this.mReorientationDiv !== null && TGE.BrowserDetect.isMobileDevice) {
            if (!correctOrientation) {
                // Hide the game div and show the reorientation div
                this.mCanvasDiv.style.display = 'none';
                this.mReorientationDiv.style.display = 'block';

                // Pause the game if running
                this.PauseGame(true);
            } else {
                // Hide the reorientation div and show the game div
                this.mReorientationDiv.style.display = 'none';
                this.mCanvasDiv.style.display = 'block';
            }
        }

        // Now that we've resized the screen, recalculate the canvas position
        this._determineCanvasPosition();

        // Always throw this in for good measure
        viewporter.refresh();
    },

    _onDeactivate : function() {
        if (this.mPlaying) {
            this.PauseGame(true);
            this.audioManager.Mute();
        }
    },

    /** @ignore */
    InitializeRenderer : function() {
        this.stage = new TGE.Stage(this.mCanvasDiv, this.assetManager);
    },

    /** @ignore */
    BeginLoad : function() {
        // Load the assets required for the loading screen
        this.assetManager.loadAssetList("loading", null, this.LoadRequiredAssets.bind(this));
    },

    /** @ignore */
    LoadRequiredAssets : function() {
        // Initialize the screen manager so we can make a loading screen
        this.mScreenManager.Initialize(this);

        // If a loading screen has been defined, show it
        var updateCallback = null;
        if ( typeof (LoadingScreen) != "undefined") {
            this.mLoadingScreen = this.ShowScreen(LoadingScreen);

            // Setup a callback so we can display the progress
            updateCallback = this.loadRequiredAssetsCallback.bind(this);
        }

        // Start the engine update loop now that we have stuff to draw
        this.Update();

        // Kick off the loading
        this.assetManager.loadAssetList("required", updateCallback, this.finishedLoadingRequiredAssets.bind(this));
    },

    /** @ignore */
    loadRequiredAssetsCallback : function(percentComplete) {
        // If there is a loading screen, update it's progress
        if (this.mLoadingScreen != null && typeof (this.mLoadingScreen.UpdateProgress) == "function") {
            this.mLoadingScreen.UpdateProgress(percentComplete);
        }
    },

    /** @ignore */
    finishedLoadingRequiredAssets : function() {
        // Determine the total time it took to do the loading
        var loadTime = Math.round((new Date().getTime() - this.mLoadingStartTime) / 1000);
        this.AnalyticGameEvent('load', loadTime);

        TGE.debugLog("finishedLoadingRequiredAssets calling _resizeViewport");

        this._resizeViewport();

        // Start with the main menu
        this.GotoMainMenu();
    },

    LoadLevelAssets : function(level, updateCallback, completeCallback) {
        this.assetManager.loadAssetList("level_" + level.toString(), updateCallback, completeCallback);
    },

    StartLevel : function(levelNumber) {
        var replay = levelNumber == this.mCurrentLevel;

        this.mCurrentLevel = levelNumber;
        this.subclassSetupLevel(this.mCurrentLevel);

        this.AnalyticLevelEvent( replay ? 'replay' : 'start');

        // If we're not already playing - start!
        if (!this.mPlaying || this.mPaused) {
            this.StartPlaying();
        }
    },

    FinishLevel : function() {
        this.AnalyticLevelEvent('complete');

        this.subclassFinishLevel();
    },

    Replay : function() {
        this.StartLevel(this.mCurrentLevel);
    },

    StartPlaying : function() {
        this.mGameTime = 0;
        this.mPaused = false;
        this.mPlaying = true;

        // Do the game-specific stuff
        this.subclassStartPlaying();
    },

    ClearScene : function() {
        // Purge everything in the object managers
        this.mGameManager.Purge();
        this.mUIManager.Purge();

        // Reset the camera
        this.mCameraLocation = new TGE.Point();

        // Clear the scene graph
        this.stage.clearChildren();

        // FPS text must be reset
        this.mFPSText = null;

        // Setup the layers that will be used for rendering
        this.SetupLayers();

        // Initialize the screen manager here so it is on top
        this.mScreenManager.Initialize(this);

        // Create a layer for the fps display
        this.CreateLayer("FPS");

        // Create a pause button if assets were provided
        var pauseButtonImage = this.assetManager.getImage("pause_button", false);
        if (pauseButtonImage != null && pauseButtonImage.width > 0) {
            var pauseButtonSize = Math.max(pauseButtonImage.width, pauseButtonImage.height);
            this.mPauseButton = this.CreateUIEntity(TGE.ScreenEntity).Setup(this.Width() - pauseButtonSize / 2, pauseButtonSize / 2, "pause_button", "ScreenManager");
            this.EnableUserPause();
        }
    },

    SetupLayers : function() {
        this.mLayers = {};
        this.CreateLayer("TGE_default");
        this.subclassSetupLayers();
    },

    /**
     *
     * @param classType
     * @return Returns the new screen that was created and displayed.
     */
    ShowScreen : function(classType) {
        return this.mScreenManager.ShowScreen(classType);
    },

    GotoMainMenu : function() {
        // Make sure we're not still paused or playing
        this.mPaused = false;
        this.mPlaying = false;

        // Clear the scene
        this.ClearScene();

        // Load the main menu if one exists
        if ( typeof (MainMenu) != "undefined") {
            this.ShowScreen(MainMenu);
        } else {
            // Just initiate the game
            this.StartPlaying();
        }
    },

    /**
     * Pauses or unpauses gameplay. Also shows or hides the pause screen if an appropriate PauseScreen class exists.
     * @param bSetValue {Boolean} True to pause the game, false to unpause the game.
     */
    PauseGame : function(bSetValue) {
        var pauseScreenImplemented = typeof (PauseScreen) != "undefined";

        // If the pause state isn't changing, or we're not playing (haven't started or game is over),
        // then pausing is not applicable. We also shouldn't pause if there is no pause screen, otherwise
        // the player has no way to un-pause.
        if (!this.mPlaying || bSetValue === this.mPaused || !pauseScreenImplemented) {
            return;
        }

        this.mPaused = bSetValue;

        // Analytic events
        this.AnalyticGameEvent(this.mPaused ? "pause" : "resume", this.mCurrentLevel);

        // Make sure we have the canvas position (could be lost due to reorientation)
        this._determineCanvasPosition();

        // Show/hide the pause screen if one has been defined
        if (pauseScreenImplemented) {
            if (this.mPaused) {
                this.ShowScreen(PauseScreen, false);
                this.DisableUserPause();
            } else {
                this.mScreenManager.CloseScreen(PauseScreen);
                this.EnableUserPause();
            }
        }
    },

    DisableUserPause : function() {
        this.mUserPauseEnabled = false;
        if (this.mPauseButton != null) {
            this.mPauseButton.Hide();
        }
    },

    EnableUserPause : function() {
        this.mUserPauseEnabled = true;
        if (this.mPauseButton != null) {
            this.mPauseButton.Show();
        }
    },

    Update : function() {
        // Hack - intentionally slow down the framerate for testing
        //var start = new Date().getTime();
        //var delay = 22;
        //while (new Date().getTime() < start + delay);

        // Calculate the elapsed time since the last update
        var elapsedTime = (this.mThisLoop = new Date) - this.mLastLoop;
        this.mFrameTime += (elapsedTime - this.mFrameTime) / this.mFilterStrength;
        this.mLastLoop = this.mThisLoop;

        // Update the frame rate display
        this.updateFPSDisplay();

        // Convert to seconds
        elapsedTime = elapsedTime / 1000;

        // Check the tick interval caps
        elapsedTime = Math.max(this.mMinTickTime, elapsedTime);
        elapsedTime = Math.min(this.mMaxTickTime, elapsedTime);

        // Track the running game time
        if (!this.mPaused) {
            this.mGameTime += elapsedTime;
        }

        // Always update screens
        this.mScreenManager.Update(elapsedTime);

        // UI objects need to be notified of mouse activity even when paused
        //this.mUIManager.NotifyObjectsOfMouseOver(this.mMouseX, this.mMouseY);
        this.stage._updateObjectMouseOverStates(this.mMouseX, this.mMouseY);

        if (!this.mPaused) {
            // Check for mouse over interactions
            //this.mGameManager.NotifyObjectsOfMouseOver(this.mMouseX, this.mMouseY);

            // Update the objects in the world
            this.updateObjects(elapsedTime);
        }

        // Update the game state if we're playing
        if (this.mPlaying && !this.mPaused) {
            this.subclassUpdateGame(elapsedTime);
        }

        // Update the positions of the objects on screen (it is best
        // to do this last to avoid jittering problems caused when the
        // camera is following a game object)
        this._updateObjectsToScreen();

        // Do this before rendering - http://paulirish.com/2011/requestanimationframe-for-smart-animating/
        requestAnimFrame(this.Update.bind(this));

        // Update our renderable entities
        this.stage.draw();
    },

    SetConstantTickTime : function(interval) {
        this.mMinTickTime = this.mMaxTickTime = interval;
    },

    SetBackgroundColor : function(color) {
        this.stage.backgroundColor = color;
    },

    CreateLayer : function(layerName) {
        var newLayer = new TGE.DisplayObjectContainer();
        this.mLayers[layerName] = newLayer;
        newLayer.registrationX = 0;
        newLayer.registrationY = 0;
        this.stage.addChild(newLayer);
    },

    /**
     * Creates an object that only exists within the game world. When the game is paused or not playing, these objects will not be updated or receive user input events.
     * @param classType
     * @return {*}
     */
    CreateWorldEntity : function(classType) {
        // Create a new object of this type and initialize it with the game object
        var newObj = new classType;
        classType.prototype.constructor.apply(newObj, [this]);

        // Add it to the object manager
        this.mGameManager.AddObject(newObj);

        return newObj;
    },

    /**
     * Creates an object that exists on top of the game world. When the game is paused or not playing, these objects will still be updated and receive user input events. Intended for creating user interface elements.
     * @param classType
     * @return {*}
     */
    CreateUIEntity : function(classType) {
        // Create a new object of this type and initialize it with the game object
        var newObj = new classType;
        classType.prototype.constructor.apply(newObj, [this]);

        // Add it to the object manager
        this.mUIManager.AddObject(newObj);

        return newObj;
    },

    /** @ignore */
    getLayer : function(layerName) {
        // If the layerName is null or doesn't exist, try to use the default layer
        var layer = "TGE_default" in this.mLayers ? this.mLayers["TGE_default"] : this.stage;
        if (layerName != null && layerName in this.mLayers) {
            layer = this.mLayers[layerName];
        }

        return layer;
    },

    ShowFramerateDisplay : function(x, y, fontSize, color) {
        if (this.mFPSText != null) {
            this.mFPSText.markForRemoval();
        }

        this.mFPSText = this.CreateUIEntity(TGE.Text).Setup(x, y, "", fontSize.toString() + "px Arial", "center", "middle", color, "FPS");
    },

    /** @ignore */
    updateFPSDisplay : function() {
        // Only update the display once per second
        var lastDisplay = this.mThisLoop - this.mLastDisplay;
        if (lastDisplay < 1000) {
            return;
        }
        this.mLastDisplay = this.mThisLoop;

        if (this.mFrameTime > 0 && this.mFPSText != null) {
            this.mFPSText.Show();
            this.mFPSText.text = (Math.round(1000 / this.mFrameTime).toFixed(0) + "fps");
        }
    },

    /** @ignore */
    updateObjects : function(elapsedTime) {
        this.mGameManager.Update(elapsedTime);
        this.mUIManager.Update(elapsedTime);
    },

    /** @ignore */
    _updateObjectsToScreen : function() {
        this.mGameManager._updateObjectsToScreen();
    },

    EndGame : function() {
        if (!this.mPlaying) {
            // The game is already over, or hasn't even started
            return;
        }

        this.mPlaying = false;

        // Analytic event
        var gameTime = Math.round(this.mGameTime);
        this.AnalyticGameEvent('end', gameTime);

        // Don't let the user pause after the game is finished
        this.DisableUserPause();

        // Let the specific game subclass process the game over
        this.subclassEndGame();

        // Load the game over screen if one exists
        if ( typeof (GameOver) != "undefined") {
            this.ShowScreen(GameOver);
        }
    },

    CurrentLevel : function() {
        return this.mCurrentLevel;
    },

    _processMousePosition : function(e) {
        if (this.mCanvasPosition === null) {
            this._determineCanvasPosition();
        }

        this.mMouseX = e.pageX;
        this.mMouseY = e.pageY;
        if (e.touches) {
            this.mMouseX = e.touches[0].clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
            this.mMouseY = e.touches[0].clientY + document.body.scrollTop + document.documentElement.scrollTop;
        }

        this.mMouseX -= this.mCanvasPosition.x;
        this.mMouseY -= this.mCanvasPosition.y;

        this.mMouseX /= this._mViewportScale;
        this.mMouseY /= this._mViewportScale;
    },

    _preventBehavior : function(e) {
        e.stopPropagation();
        e.preventDefault();
    },

    _mouseDown : function(e) {
        window.focus();

        this._processMousePosition(e);
        this.mMouseDown = true;

        // Check if they tapped pause
        if (this.mUserPauseEnabled && this.mPauseButton != null && this.mGameTime > 0.5) {
            var pauseButtonSize = Math.max(this.mPauseButton.Width(), this.mPauseButton.Height());
            if (this.mMouseX > this.Width() - pauseButtonSize && this.mMouseY < pauseButtonSize) {
                // Pause, and don't pass this event onto the game
                this.PauseGame(true);
                return;
            }
        }

        // Notify stage objects of mouse interactions
        this.stage._notifyObjectsOfMouseEvent("down", this.mMouseX, this.mMouseY);

        // If the game is paused don't pass on mouse events
        if (!this.mPaused) {
            this.subclassMouseDown();
        }

        e.stopPropagation();
        e.preventDefault();
    },

    _mouseUp : function(e) {
        //this._processMousePosition(e);
        this.mMouseDown = false;

        // Notify stage objects of mouse interactions
        this.stage._notifyObjectsOfMouseEvent("up", this.mMouseX, this.mMouseY);

        // If the game is paused don't pass on mouse events
        if (!this.mPaused) {
            this.subclassMouseUp();
        }

        e.stopPropagation();
        e.preventDefault();
    },

    _mouseMove : function(e) {
        this._processMousePosition(e);

        // If the game is paused don't pass on mouse events
        if (!this.mPaused) {
            this.subclassMouseMove();
        }

        e.stopPropagation();
        e.preventDefault();
    },

    MouseX : function() {
        return this.mMouseX;
    },

    MouseY : function() {
        return this.mMouseY;
    },

    /**
     * @ deprecated Use TGE.Game#isMouseDown instead. This function will be removed in 0.4
     */
    IsMouseDown : function() {
        return this.mMouseDown;
    },

    /**
     * Returns whether or not the left mouse button is down (or in the case of mobile, a finger is depressed).
     * @return {Boolean}
     */
    isMouseDown : function() {
        return this.mMouseDown;
    },

    _keyDown : function(e) {
        this.mKeysDown[e.keyCode] = true;

        this.subclassKeyDown(e.keyCode);
    },

    _keyUp : function(e) {
        this.mKeysDown[e.keyCode] = false;

        this.subclassKeyUp(e.keyCode);
    },

    isKeyDown : function(keyCode) {
        return this.mKeysDown[keyCode] === true;
    },

    Width : function() {
        return this.stage.width;
    },

    Height : function() {
        return this.stage.height;
    },

    GameTime : function() {
        return this.mGameTime;
    },

    NumGameObjects : function() {
        return this.mGameManager.NumObjects();
    },

    NumUIObjects : function() {
        return this.mUIManager.NumObjects();
    },

    CameraLocation : function() {
        return this.mCameraLocation;
    },

    ScreenX : function(x) {
        return (this.stage.width / 2) + (x - this.mCameraLocation.x);
    },

    ScreenY : function(y) {
        return (this.stage.height / 2) - (y - this.mCameraLocation.y);
    },

    GetImage : function(imageName) {
        return this.assetManager.getImage(imageName);
    },

    OpenURL : function(url) {
        this.AnalyticClickThruEvent(url);
        window.open(url, this.mDefaultLinkTarget);
    },

    // ------------------------------------------------------------------------------------------
    // Methods that should be implemented in your game class
    // ------------------------------------------------------------------------------------------

    PlayGame : function() {
        this.AnalyticGameEvent('begin');
        this.subclassPlayGame();
    },

    CurrentScore : function() {
        // This method should be overwritten by your game class if your game uses a score
        return 0;
    },

    subclassSetupLayers : function() {
        // Implemented in your game class - setup the layers you want to use to organize your rendering
    },

    subclassPlayGame : function() {
        this.StartLevel(-1);
    },

    subclassSetupLevel : function(levelNumber) {
        // Implemented in your game class - initialize everything for a particular level
    },

    subclassStartPlaying : function() {
        // Implemented in your game class - initialize everything for a new game
    },

    subclassStartLevel : function() {
        // Implemented in your game class - perform any necessary work needed to begin a new level
    },

    subclassFinishLevel : function() {
        // Implemented in your game class - perform any necessary work when the user completes a level
    },

    subclassUpdateGame : function(elapsedTime) {
        // Implemented in your game class - update your game state (called every tick)
    },

    subclassEndGame : function(elapsedTime) {
        // Implemented in your game class - called when the currently running game ends
    },

    subclassMouseMove : function() {
        // Implemented in your game class - mouse move handler (use this.mMouseX this.mMouseY for current location)
    },

    subclassMouseDown : function() {
        // Implemented in your game class - mouse down handler (use this.mMouseX this.mMouseY for current location)
    },

    subclassMouseUp : function() {
        // Implemented in your game class - mouse up handler (use this.mMouseX this.mMouseY for current location)
    },

    subclassKeyDown : function(keyCode) {
        // Implemented in your game class - handler for key down events
    },

    subclassKeyUp : function(keyCode) {
        // Implemented in your game class - handler for key down events
    },

    // ------------------------------------------------------------------------------------------
    // Analytics wrapper functions users can use in their game
    // ------------------------------------------------------------------------------------------

    AnalyticGameEvent : function(eventName, value) {
        if (this.analytics !== null) {
            this.analytics.logGameEvent(eventName, this.mCurrentLevel, value);
        }
    },

    AnalyticShareEvent : function(eventName) {
        if (this.analytics !== null) {
            this.analytics.logShareEvent(eventName, this.mCurrentLevel);
        }
    },

    AnalyticLevelEvent : function(eventName) {
        if (this.analytics !== null) {
            this.analytics.logLevelEvent(eventName, this.mCurrentLevel, Math.floor(this.mGameTime));
        }
    },

    AnalyticAchievementEvent : function(achievementName, value) {
        if (this.analytics !== null) {
            this.analytics.logAchievementEvent(achievementName, this.mCurrentLevel, value);
        }
    },

    AnalyticErrorEvent : function(errorEvent) {
        if (this.analytics !== null) {
            this.analytics.logErrorEvent(errorEvent);
        }
    },

    AnalyticClickThruEvent : function(url) {
        if (this.analytics !== null) {
            this.analytics.logClickThruEvent(url, this.mCurrentLevel);
        }
    },

    AnalyticCustomEvent : function(customLabel, value) {
        if (this.analytics !== null) {
            this.analytics.logCustomEvent(customLabel, this.mCurrentLevel, value);
        }
    }
}

/**
 * @constant
 */
TGE.KEY_ARROW_LEFT = 37;

/**
 * @constant
 */
TGE.KEY_ARROW_RIGHT = 39;

/**
 * @constant
 */
TGE.KEY_ARROW_UP = 38;

/**
 * @constant
 */
TGE.KEY_ARROW_DOWN = 40;

/**
 * @constant
 */
TGE.KEY_SPACEBAR = 32;
/**
 * @class
 * @ignore
 * @constructor
 */
TGE.ObjectsManager = function() {
    this.mObjectsArray = [];
}

TGE.ObjectsManager.prototype = {
    /** @ignore */
    AddObject : function(obj) {
        this.mObjectsArray.push(obj);
    },

    /** @ignore */
    Update : function(elapsedTime) {
        // Update all the objects
        for (var i = this.mObjectsArray.length - 1; i >= 0; i--) {
            // Update the object
            this.mObjectsArray[i].Update(elapsedTime);

            // Does it need to be removed?
            if (this.mObjectsArray[i].MarkedForRemoval()) {
                this.mObjectsArray[i].Cleanup();
                this.mObjectsArray.splice(i, 1);
            }
        }
    },

    /** @ignore */
    _updateObjectsToScreen : function() {
        // Update all the object's screen positions
        for (var i = 0; i < this.mObjectsArray.length; i++) {
            this.mObjectsArray[i]._updateScreenPosition();
        }
    },

    /** @ignore */
    Purge : function() {
        // Update all the objects
        for (var i = this.mObjectsArray.length - 1; i >= 0; i--) {
            this.mObjectsArray[i].Cleanup();
            this.mObjectsArray.splice(i, 1);
        }
    },

    /** @ignore */
    NumObjects : function() {
        return this.mObjectsArray.length;
    }
}/**
 * @ignore
 * @class Used to specify groups of assets that can be loaded at different points within your game. For example, loading level-specific assets.
 * @constructor
 */
TGE.AssetLoader = function() {
    this.mAssetList = null;
    this.mUpdateCallback = null;
    this.mCompleteCallback = null;
    return this;
}

TGE.AssetLoader.prototype = {

    /** @ignore */
    loadAssetList : function(assetManager, assetList, rootLocation, updateCallback, completeCallback) {
        // Make sure the root location parameter is valid
        rootLocation = typeof rootLocation === "string" ? rootLocation : "";
        if (rootLocation.length > 0 && rootLocation.charAt(rootLocation.length - 1) !== "/") {
            rootLocation = rootLocation.concat("/");
        }

        this.mAssetList = assetList;
        this.mUpdateCallback = updateCallback;
        this.mCompleteCallback = completeCallback;

        var loader = new PxLoader();
        var audioCount = 0;
        if (assetList !== null && assetList.list.length > 0 && assetList.loaded === false) {
            for ( i = 0; i < assetList.list.length; i++) {
                var newAsset = null;
                if (assetList.list[i].assetType === "audio") {
                    if (assetManager.loadAudio) {
                        newAsset = loader.addAudio(assetList.list[i].id, rootLocation + assetList.list[i].url, rootLocation + assetList.list[i].backup_url, null, null);
                        audioCount++;
                    }
                } else if (assetList.list[i].assetType === "audio_sprite") {
                    newAsset = {
                        assetType : "audio_sprite",
                        id : assetList.list[i].sprite,
                        startTime : assetList.list[i].startTime,
                        endTime : assetList.list[i].endTime
                    };
                } else {
                    newAsset = loader.addImage(rootLocation + assetList.list[i].url);
                }

                // newAsset could be null at this point if an audio asset is being loaded but
                // loadAudio is false.
                if (newAsset !== null) {
                    assetManager.addImage(assetList.list[i].id, newAsset);
                }
            }

            loader.addProgressListener(TGE.AssetLoader.prototype._loaderCallback.bind(this));
            loader.addCompletionListener(TGE.AssetLoader.prototype._completeCallback.bind(this));
            loader.start();
        } else {
            if (this.mUpdateCallback !== null) {
                // Technically we are 100% loaded, we should broadcast this
                this.mUpdateCallback(1);
            }

            if (this.mCompleteCallback !== null) {
                // Nothing to load, so skip right to the complete callback
                this.mCompleteCallback.call();
            }
        }
    },

    _loaderCallback : function(e) {
        // Check for an error
        if (e.error) {
            TGE.log("***** ERROR: could not load image '" + e.resource.getName() + "'");
        }

        // If there is a level loading callback, call it
        if (this.mUpdateCallback !== null) {
            var percentComplete = e.completedCount / e.totalCount;
            this.mUpdateCallback(percentComplete);
        }
    },

    _completeCallback : function() {
        // Mark this list as being loaded
        if (this.mAssetList !== null) {
            this.mAssetList.loaded = true;
            this.mAssetList = null;
        }

        // If there is a level loading callback, call it
        if (this.mCompleteCallback !== null) {
            this.mCompleteCallback();
        }
    }
}

TGE.AssetManager = function(loadAudio) {
    // Do we already have an instance?
    if (TGE.AssetManager.sAssetManagerInstance !== null) {
        return TGE.AssetManager.sAssetManagerInstance;
    }
    TGE.AssetManager.sAssetManagerInstance = this;

    if (loadAudio === undefined) {
        loadAudio = true;
    }

    this.rootLocation = "";
    this.loadAudio = loadAudio;

    return this;
}

TGE.AssetManager.sAssetManagerInstance = null;

TGE.AssetManager.GetImage = function(id) {
    return TGE.AssetManager.sAssetManagerInstance === null ? null : TGE.AssetManager.sAssetManagerInstance.getImage(id);
}

TGE.AssetManager.prototype = {
    _mImageAssetLists : [],
    _mImageCache : [],

    //ToDo - Oliver to add rest of documentation for this function
    /**
     * used for preloading the audio
     * @param category  {String} The value can be  - 'loading' or 'required'
     * @param assetList {JSON Object} containing the details as follows
     {id:'bgsound',url:'sounds/background.ogg', backup_url:'sounds/background.mp3', assetType:"audio"}

     */
    assignImageAssetList : function(category, assetList) {
        this._mImageAssetLists[category] = {
            loaded : false,
            list : assetList
        };
    },

    loadAssetList : function(category, updateCallback, completeCallback) {
        var assetLoader = new TGE.AssetLoader();
        var assetList = this._mImageAssetLists[category];

        if (assetList) {
            assetLoader.loadAssetList(this, assetList, this.rootLocation, updateCallback, completeCallback);
        } else {
            // Asset list was not found, fire the callback right away
            TGE.log("TGE.AssetManager could not locate asset list '" + category + "'");
            if (completeCallback) {
                completeCallback.call();
            }
        }
    },

    addImage : function(id, image) {
        this._mImageCache[id] = image;
    },

    getImage : function(id, errorCheck) {
        errorCheck = typeof errorCheck === "undefined" ? true : errorCheck;
        var imageAsset = this._mImageCache[id];
        if (errorCheck && id != null && !imageAsset) {
            TGE.log("***** ERROR: TGE.AssetManager.getImage could not find the asset '" + id + "'");
        }
        return imageAsset;
    }
}
TGE.SpriteAnimation = function(spriteHost, image, rows, columns, numFrames, fps, looping) {
    this.mFPS = fps;
    this.mNumberOfFrames = numFrames;
    this.mLooping = looping;

    this.mAge = 0;
    this.mPaused = false;
    this.mFinishedCallback = null;
    this.mFrameOffset = 0;
    this.mCurrentFrame = 0;

    this.mSprite = new TGE.Sprite();
    this.mSprite.setImage(image, rows, columns);
    this.mSprite.visible = false;
    spriteHost.addChild(this.mSprite);

    // The animation's registration point should match the host
    this.mSprite.registrationX = spriteHost.registrationX;
    this.mSprite.registrationY = spriteHost.registrationY;
}

TGE.SpriteAnimation.prototype = {
    Play : function(finishedCallback) {
        this.mAge = 0;
        this.mFinishedCallback = finishedCallback;
        this.mSprite.setSpriteIndex(0);
        this.mSprite.visible = true;
    },

    Pause : function() {
        this.mPaused = true;
    },

    Stop : function() {
        this.mSprite.visible = false;
    },

    Resume : function() {
        this.mPaused = false;
    },

    SetAnimationIndexOffset : function(offset) {
        this.mFrameOffset = offset;
    },

    Update : function(elapsedTime) {
        if (!this.mPaused) {
            this.mAge += elapsedTime;
        }

        var frameLength = 1.0 / this.mFPS;
        var framesPlayed = Math.floor(this.mAge / frameLength);

        // Set the current frame
        this.mCurrentFrame = 0;
        if (this.mLooping || framesPlayed < this.mNumberOfFrames) {
            this.mCurrentFrame = framesPlayed % this.mNumberOfFrames;
        } else {
            this.mCurrentFrame = this.mNumberOfFrames - 1;

            // If there is a function to call when finished, call it
            if (this.mFinishedCallback != null) {
                this.mFinishedCallback.call();
                this.mFinishedCallback = null;
            }
        }

        this.mCurrentFrame += this.mFrameOffset;
        this.mSprite.setSpriteIndex(this.mCurrentFrame);
    }
}
TGE.KeyframedAnimation = function(animationPlayer, id, partInstances, looping, finishedCallback) {
    this.mAnimationPlayer = animationPlayer;
    this.mAnimationID = id;
    this.mPartInstances = partInstances;
    this.mLooping = looping;
    this.mFinishedCallback = finishedCallback;
    this.mSmoothTransitions = false;
    this.mAge = 0;
    this.mPaused = false;

    // Make sure this animation is legit
    if (!this.mAnimationPlayer.AnimationExists(id)) {
        this.Cancel();
        console.log("***** ERROR: keyframed animation not found: '" + id + "'");
    }

    return this;
}

TGE.KeyframedAnimation.prototype = {

    Pause : function() {
        this.mPaused = true;
    },

    Resume : function() {
        this.mPaused = false;
    },

    /** @ignore */
    Update : function(elapsedTime) {
        if (this.mPaused) {
            // Don't bother doing anything, leave parts in last pose
            return;
        }

        this.mAge += elapsedTime;

        // TODO - deal with looping and callback

        // Pose the part instances to reflect where they are in the given animation cycle
        this.mAnimationPlayer.PosePartInstances(this.mPartInstances, this.mAnimationID, this.mAge, this.mLooping, this.mSmoothTransitions);
    },

    /** @ignore */
    Cancel : function() {
        this.mFinishedCallback = null;
        this.Pause();
    }
}
TGE.KeyframedAnimationPlayer = function(animationData, imageAssets, imagesFolder, imageTag) {
    this.mData = null;
    this.mPartImages = null;
    this.mImageTag = ( typeof imageTag === "undefined") ? null : imageTag;

    // First lets verify the data looks valid
    if (animationData.parts === undefined || animationData.part_instances === undefined || animationData.animations === undefined || animationData.max_children === undefined || animationData.framerate === undefined) {
        return this;
    }

    // Data looks good, lets proceed...
    this.mData = animationData;
    this.mInverseGlobalScale = 1 / animationData.image_scale;

    // Add the required images to the assets array if one was specified
    if (imageAssets) {
        if ( typeof (imagesFolder) === 'undefined')
            imagesFolder = "";
        for (var key in this.mData.parts) {
            if (this.mData.parts.hasOwnProperty(key)) {
                var key2 = this.mImageTag === null ? key : this.mImageTag + "_" + key;
                imageAssets.push({
                    id : key2,
                    url : (imagesFolder + "/" + key + ".png")
                });
            }
        }
    }

    return this;
}

TGE.KeyframedAnimationPlayer.prototype = {
    Valid : function() {
        return this.mData !== null;
    },

    GetAnimations : function() {
        return this.Valid() ? this.mData.animations : null;
    },

    NumRequiredPartInstances : function() {
        return this.Valid() ? this.mData.max_children : 0;
    },

    AnimationExists : function(animationID) {
        return this.Valid() ? this.mData.animations[animationID] !== undefined : false;
    },

    InitializeImages : function(game) {
        if (this.mPartImages !== null) {
            return;
        }

        this.mPartImages = {};

        // Create an image for each part for fast and easy use on part instances
        // TODO - ultimately we would like this to be a single packed image
        for (var key in this.mData.parts) {
            if (this.mData.parts.hasOwnProperty(key)) {
                var key2 = this.mImageTag === null ? key : this.mImageTag + "_" + key;
                this.mPartImages[key] = game.GetImage(key2);
            }
        }
    },

    PosePartInstances : function(visualEntities, animationID, age, looping, smoothTransitions) {
        if (!this.Valid()) {
            return;
        }

        // Variables for current frame
        var animation = this.mData.animations[animationID];
        var numFrames = animation.frames.length;
        var lengthOfCycle = numFrames / this.mData.framerate;
        var numCyclesPlayed = Math.floor(age / lengthOfCycle);
        var positionInCycle = (!looping && numCyclesPlayed >= 1) ? numFrames - 1 : ((age - (numCyclesPlayed * lengthOfCycle)) / lengthOfCycle) * numFrames;
        var currentFrameIndex = Math.floor(positionInCycle);
        var currentFrame = animation.frames[currentFrameIndex];

        // For interpolation
        var nextFrameIndex = (currentFrameIndex + 1) % numFrames;
        var nextFrame = animation.frames[nextFrameIndex];

        // Loop through the part instances used in this frame and position them. Hide all the rest
        var numVisualEntities = visualEntities.length;
        var numRequiredPartInstances = currentFrame.instances.length;
        for (var p = 0; p < numVisualEntities; p++) {
            var entity = visualEntities[p];

            if (p >= numRequiredPartInstances) {
                // Not required
                entity.visible = false;
            } else {
                // We need this part instance... what part is it?
                var instance = currentFrame.instances[p];
                var partID = this.mData.part_instances[instance.i];
                var part = this.mData.parts[partID];

                // Set the proper image
                entity.setImage(this.mPartImages[partID]);

                // Set the registration point
                entity.registrationX = part.regx
                entity.registrationY = part.regy;

                // Determine the transformation matrix for this part instance
                var a = instance.a;
                var b = instance.b;
                var c = instance.c;
                var d = instance.d;
                var tx = instance.x;
                var ty = instance.y;

                // Interpolate between keyframes?
                if (smoothTransitions) {
                    // If there is a next frame for this part instance, interpolate between the 2 frames
                    var instanceInNextFrame = nextFrame.instances[nextFrame.instances_map[instance.i]];
                    if (instanceInNextFrame !== undefined) {
                        var weight = positionInCycle - currentFrameIndex;
                        a = instance.a + (instanceInNextFrame.a - instance.a) * weight;
                        b = instance.b + (instanceInNextFrame.b - instance.b) * weight;
                        c = instance.c + (instanceInNextFrame.c - instance.c) * weight;
                        d = instance.d + (instanceInNextFrame.d - instance.d) * weight;
                        tx = instance.x + (instanceInNextFrame.x - instance.x) * weight;
                        ty = instance.y + (instanceInNextFrame.y - instance.y) * weight;
                    }
                }

                // Need to apply the inverse of the scale applied to the images
                a *= this.mInverseGlobalScale;
                b *= this.mInverseGlobalScale;
                c *= this.mInverseGlobalScale;
                d *= this.mInverseGlobalScale;

                // Apply the final transformation to the screen entity
                entity.setLocalTransform(a, b, c, d, tx, ty);

                // Show the part instance
                entity.visible = true;
            }
        }
    }
}/**
 * @class The most basic entity type - an object that is positioned in screen space and represented by an image.
 * @param game {@link TGE.Game} The game instance that this object is a part of.
 * @extends TGE.Sprite
 * @constructor
 */
TGE.ScreenEntity = function(game) {
    TGE.ScreenEntity.superclass.constructor.call(this);

    this.mGame = game;
    this.mAge = 0;
    this.mMarkedForRemoval = false;

    this.mAnimations = [];
    this.mCurrentAnimation = null;

    this.mKeyframedAnimationPlayer = null;
    this.mAnimationPartInstances = [];
    this.mCurrentKeyframedAnimation = null;
    this.mCurrentKeyframedAnimationID = null;
}

TGE.ScreenEntity.prototype = {
    _mCameraCulling : null,

    /**
     * Initializes the basic properties of a ScreenEntity object.
     * @param x {Number} The horizontal position of the object on the game canvas (in pixels).
     * @param y {Number} The vertical position of the object on the game canvas (in pixels).
     * @param [imageID] {String} The id of the image used to represent this object. If an image is set using this function it can only be a single frame (1x1 compound image).
     * @param [layerID] {String} The id of the layer to add this object to. If not specified, the object will be added to the default back layer.
     * @return {TGE.ScreenEntity}
     */
    Setup : function(x, y, imageID, layerID) {
        this.mLayer = layerID;
        this.x = x;
        this.y = y;
        this.setImage(this.mGame.GetImage(imageID));
        this.mGame.getLayer(this.mLayer).addChild(this);

        return this;
    },

    /**
     * Set the image used to represent this object.
     * @param imageID {String} The id of the image used to represent this object. The image is assumed to be a compound image composed of rows and columns of equally sized frames.
     * A single image can be thought of as a 1x1 compound image. If there is more than one frame you can specify which one to display using {@link TGE.ScreenEntity#SetImageIndex}
     * @param [rows=1] {Number} The number of rows in the image if this is a compound image.
     * @param [columns=1] {Number} The number of columns in the image if this is a compound image.
     * @see TGE.ScreenEntity#SetImageIndex
     */
    SetImage : function(imageName, rows, columns) {
        var image = this.mGame.GetImage(imageName);
        if (image == null) {
            return;
        }

        // Default number of frames in the image is 1x1
        rows = typeof rows !== 'undefined' ? rows : 1;
        columns = typeof columns !== 'undefined' ? columns : 1;
        this.setImage(image, rows, columns);
    },

    /**
     * Setup an animation for playback. An animation can be played at any time without needing to be loaded again.
     * @param id {String} An id used to reference the animation so it can be played later.
     * @param imageID {String} The id of the image to use for this animation. The image is assumed to be a compound image composed of rows and columns of equally sized frames.
     * @param [rows=1] {Number} The number of rows in the image.
     * @param [columns=1] {Number} The number of columns in the image.
     * @param numFrames {Number} The number of frames in the animation. Can be equal to or less than the number of rows*columns.
     * @param fps {Number} The number of frames per second the animation should be played at.
     * @param looping {Boolean} Indicates whether to stop or replay the animation once it reaches the last frame.
     * @see TGE.ScreenEntity#PlayAnimation
     * @see TGE.ScreenEntity#PlayAnimationFromStart
     */
    LoadAnimation : function(id, imageID, rows, columns, numFrames, fps, looping) {
        var newAnimation = new TGE.SpriteAnimation(this, this.mGame.GetImage(imageID), rows, columns, numFrames, fps, looping);
        this.mAnimations[id] = newAnimation;
    },

    /**
     * Plays the specified animation (if it is not already playing). The animation must have been initialized already by calling {@link TGE.ScreenEntity#LoadAnimation}.
     * @param id {String} The id of the animation to play.
     * @param [finishedCallback] {Function} A function that can be called when the animation finishes.
     * @see TGE.ScreenEntity#LoadAnimation
     * @see TGE.ScreenEntity#PlayAnimationFromStart
     */
    PlayAnimation : function(id, finishedCallback) {
        // Don't play the animation if it's already playing
        if (this.mCurrentAnimation == this.mAnimations[id]) {
            return;
        }

        this.PlayAnimationFromStart(id, finishedCallback);
    },

    /**
     * Plays an animation from its first frame, even if the animation is already playing. The animation must have been initialized already by calling {@link TGE.ScreenEntity#LoadAnimation}.
     * @param id {String} The id of the animation to play.
     * @param [finishedCallback] {Function} A function that can be called when the animation finishes.
     * @see TGE.ScreenEntity#LoadAnimation
     * @see TGE.ScreenEntity#PlayAnimation
     */
    PlayAnimationFromStart : function(id, finishedCallback) {
        var anim = this.mAnimations[id];
        if (anim != null) {
            // Stop any current animation
            if (this.mCurrentAnimation !== null) {
                this.mCurrentAnimation.Stop();
            }

            // Clear out any static image
            this.setImage(null);

            this.mCurrentAnimation = anim;
            this.mCurrentAnimation.Play(finishedCallback);

            // Kind of hackish... this should really happen automatically
            this.width = this.mCurrentAnimation.mSprite.width;
            this.height = this.mCurrentAnimation.mSprite.height;
        }
    },

    /**
     * Stops the current sprite sheet animation that is playing and removes it.
     */
    removeCurrentAnimation : function() {
        // Stop any current animation
        if (this.mCurrentAnimation !== null) {
            this.mCurrentAnimation.Stop();
        }

        // Clear out any static image
        this.setImage(null);

        this.mCurrentAnimation = null;
        this.width = this.height = 0;
        this._boundingInfoDirty = true;
    },

    InitializeKeyframedAnimations : function(keyframedAnimationPlayer) {
        this.mKeyframedAnimationPlayer = keyframedAnimationPlayer;

        // Make sure the required images are loaded
        this.mKeyframedAnimationPlayer.InitializeImages(this.mGame);

        // If an animation is currently playing, shut it down
        if (this.mCurrentKeyframedAnimation !== null) {
            this.mCurrentKeyframedAnimation.Cancel();
        }

        // Cleanup the part instances if there was a previous player
        if (this.mAnimationPartInstances.length > 0) {
            var len = this.mAnimationPartInstances.length;
            for (var p = 0; p < len; p++) {
                this.mAnimationPartInstances[p].markForRemoval();
            }
        }

        // Create a child entity for each part instance
        this.mAnimationPartInstances = [];
        var numPartInstances = this.mKeyframedAnimationPlayer.NumRequiredPartInstances();
        for (var p = 0; p < numPartInstances; p++) {
            var newChild = this.addChild(new TGE.Sprite());

            // Hide it until it's needed
            newChild.visible = false;

            // Keep track of the parts
            this.mAnimationPartInstances.push(newChild);
        }
    },

    PlayKeyframedAnimation : function(id, looping, finishedCallback) {
        // Don't play the animation if it's already playing
        if (this.mCurrentKeyframedAnimationID === id) {
            return;
        }

        this.PlayKeyframedAnimationFromStart(id, looping, finishedCallback);
    },

    PlayKeyframedAnimationFromStart : function(id, looping, finishedCallback) {
        // Default arguments
        if ( typeof (looping) === 'undefined')
            looping = true;
        if ( typeof (finishedCallback) === 'undefined')
            finishedCallback = null;

        // If an animation is currently playing, shut it down
        if (this.mCurrentKeyframedAnimation !== null) {
            this.mCurrentKeyframedAnimation.Cancel();
        }

        // Create the new animation
        this.mCurrentKeyframedAnimation = new TGE.KeyframedAnimation(this.mKeyframedAnimationPlayer, id, this.mAnimationPartInstances, looping, finishedCallback);
        this.mCurrentKeyframedAnimationID = id;
    },

    /**
     * The number of seconds the entity has been in existence.
     * @return {Number} The age of the entity in seconds.
     */
    Age : function() {
        return this.mAge;
    },

    // This function should not be called directly. To add customized behavior override the subclassUpdate function.
    /** @ignore */
    Update : function(elapsedTime) {
        this.mAge += elapsedTime;

        this.subclassUpdate(elapsedTime);

        // Is this object be removed?
        if (this.ShouldBeRemoved()) {
            this.markForRemoval();
        }

        // Update any animation that is playing
        if (this.mCurrentAnimation != null) {
            this.mCurrentAnimation.Update(elapsedTime);
        }

        // Update any keyframed animation that is playing
        if (this.mCurrentKeyframedAnimation !== null) {
            this.mCurrentKeyframedAnimation.Update(elapsedTime);
        }
    },

    /** @ignore */
    Cleanup : function() {
        // Do any subclass specific cleanup
        this.subclassCleanup();

        this.clearChildren();

        // Remove this object from the parent
        if (this.parent !== null) {
            this.parent.removeChild(this);
        }
    },

    /**
     * Call this function to flag an entity for removal from the game. It will be cleaned up and removed during the next update cycle.
     */
    markForRemoval : function() {
        this.mMarkedForRemoval = true;
        var len = this._mChildren.length;
        for (var i = 0; i < len; i++) {
            this._mChildren[i].markForRemoval();
        }
    },

    /**
     * Indicates whether an entity has been flagged for removal from the game.
     * @return {Boolean} True if the entity has been flagged for removal, false otherwise.
     */
    MarkedForRemoval : function() {
        return this.mMarkedForRemoval;
    },

    // This function should not be called directly. To add customized behavior to your class, override the subclassShouldBeRemoved function
    /** @ignore */
    ShouldBeRemoved : function() {
        // If the camera culling sides are set and the object has passed
        // out of the camera's view on that side, it will be removed
        if (this._mCameraCulling !== null) {
            var aabb = this.getBounds();

            // Top
            if (this._mCameraCulling[0] && aabb.y + aabb.height < 0) {
                return true;
            }

            // Right
            if (this._mCameraCulling[1] && aabb.x > this.mGame.Width()) {
                return true;
            }

            // Bottom
            if (this._mCameraCulling[2] && aabb.y > this.mGame.Height()) {
                return true;
            }

            // Left
            if (this._mCameraCulling[3] && aabb.x + aabb.width < 0) {
                return true;
            }
        }

        return this.subclassShouldBeRemoved();
    },

    /**
     * This function is called on the entity automatically every update cycle, telling it how much time has passed since the previous update cycle.
     * Override this function in an entity subclass to define customized behavior.
     * @param elapsedTime {Number} The amount of time in seconds that has elapsed since the last update cycle.
     */
    subclassUpdate : function(elapsedTime) {

    },

    /**
     * Indicates whether the entity should be removed from the game. Override this function in an entity subclass to define customized behavior.
     * @return {Boolean} True is the entity should be flagged for removal from the game, false if it should be kept.
     */
    subclassShouldBeRemoved : function() {
        return false;
    },

    /**
     * This function is called automatically before an entity is removed from the game. Override this function in an entity subclass to define customized behavior.
     */
    subclassCleanup : function() {

    },

    /** @ignore */
    _updateScreenPosition : function() {

    },

    /**
     * @deprecated Since version 0.3 - you should now use this.rotation
     * Apply a rotation to the image representing the object.
     * @param angle {Number} Rotation to apply to the entity in radians.
     * @param [anchorX] {Number} X-coordinate of an optional anchor point to rotate around.
     * @param [anchorY] {Number} Y-coordinate of an optional anchor point to rotate around.
     */
    SetRotation : function(angle) {
        this.rotation = angle;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.visible
     * Apply a scaling factor to the entity.
     * @param scaleX {Number} The horizontal scaling applied to the entity.
     * @param [scaleY] {Number} The vertical scaling applied to the entity. If not specified, the horizontal scaling factor will be applied vertically for uniform scaling.
     */
    SetScale : function(scaleX, scaleY) {
        scaleY = typeof scaleY === "undefined" ? scaleX : scaleY;
        this.scaleX = scaleX;
        this.scaleY = scaleY;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.alpha
     * Sets the opacity of the entity's visual appearance.
     * @param alpha {Number} An alpha value between 0 (fully transparent) to 1 (fully opaque).
     */
    SetAlpha : function(alpha) {
        this.alpha = alpha;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.width
     * Returns the width of the current visual representation of the entity.
     * @return {Number} Current visible width of the entity in pixels.
     */
    Width : function() {
        return this.width;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.height
     * Returns the height of the current visual representation of the entity.
     * @return {Number} Current visible height of the entity in pixels.
     */
    Height : function() {
        return this.height;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.visible
     * Indicates that the object should be made visible.
     * @see TGE.ScreenEntity#Hide
     * @see TGE.ScreenEntity#Visible
     */
    Show : function() {
        this.visible = true;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.visible
     * Indicates that the object should be made invisible.
     * @see TGE.ScreenEntity#Show
     * @see TGE.ScreenEntity#Visible
     */
    Hide : function() {
        this.visible = false;
    },

    /**
     * @deprecated Since version 0.3 - you should now use this.visible
     * Indicates whether or not the object is visible.
     * @return {Boolean}
     * @see TGE.ScreenEntity#Show
     * @see TGE.ScreenEntity#Hide
     */
    Visible : function() {
        return this.visible;
    }
}
extend(TGE.ScreenEntity, TGE.Sprite);
/**
 * @class A screen entity that responds to user input and fires a callback function when clicked/tapped. Buttons can be setup to show different images for idle, hover, down, and disabled states.
 * @param game {@link TGE.Game} The game instance that this object is a part of.
 * @extends TGE.ScreenEntity
 * @constructor
 */
TGE.Button = function(game) {
    TGE.ScreenEntity.call(this, game);

    // Always receive mouse events
    this.mouseEnabled = true;

    this.mState = "idle";
    this.mMouseDown = false;
    this.mPressFunction
}

TGE.Button.prototype = {
    /**
     * Initializes the basic properties of a Button object.
     * @param x {Number} The horizontal position of the button on the game canvas (in pixels).
     * @param y {Number} The vertical position of the button on the game canvas (in pixels).
     * @param imageID {String} The id of the image used to represent the button's states. Can be a compound images with up to 4 states: idle, hover, down, and disable.
     * @param pressFunction {Function} The callback function that should be fired when the button is clicked/tapped. This button object will be passed as the first argument to the callback function.
     * @param numStates {Number} The number of states represented in the button image. The states must be defined in the following order: idle, hover, down, disable.
     * @param [layerID] {String} The id of the layer to add this button to. If not specified, the button will be added to the default back layer.
     * @return {TGE.Button}
     */
    Setup : function(x, y, imageID, pressFunction, numStates, layerID) {
        this.mNumStates = numStates;

        // Do the super setup (we'll take care of the images ourselves though)
        TGE.ScreenEntity.prototype.Setup.call(this, x, y, null, layerID);

        // Setup the image specifying it's multiple states
        this.SetImage(imageID, 1, numStates);

        // Save the function that gets called on press
        this.mPressFunction = pressFunction;

        this.setButtonState("idle");

        return this;
    },

    /** @ignore */
    MouseDown : function() {
        this.mMouseDown = true;
    },

    /** @ignore */
    MouseOver : function() {

    },

    /** @ignore */
    /*MouseDown: function()
    {
    this.mMouseDown = true;
    },*/

    /** @ignore */
    MouseUp : function() {
        if (this.mPressFunction != null && this.mMouseDown) {
            // Pass this button object as the first argument to the callback (PAN-72)
            // (the first "this" gets overwritten by the bind function)
            this.mPressFunction.call(this, this);
        }
        this.mMouseDown = false;
    },

    /** @ignore */
    subclassUpdate : function(elapsedTime) {
        // See if the mouse is down
        this.mMouseDown = this.mMouseDown && this.mGame.IsMouseDown();

        // Check for the hover state
        if (this._mMouseOver) {
            this.setButtonState(this.mMouseDown ? "down" : "hover");
        } else {
            this.setButtonState("idle");
        }
    },

    /** @ignore */
    setButtonState : function(state) {
        if (state == this.mState) {
            return;
        }

        this.mState = state;

        var index = 0;
        switch(this.mState) {
            case "disable":
                index = 3;
                break;
            case "down":
                index = 2;
                break;
            case "hover":
                index = 1;
                break;
            case "idle":
            default:
                index = 0;
                break;
        }

        if (index < this.mNumStates) {
            this.setSpriteIndex(index);
        }
    }
}
extend(TGE.Button, TGE.ScreenEntity);
/**
 * @class A screen entity that is used to display html text on the game canvas.
 * @param game {@link TGE.Game} The game instance that this object is a part of.
 * @extends TGE.ScreenEntity
 * @constructor
 */
TGE.Text = function(game) {
    TGE.Text.superclass.constructor.call(this, game);

    this.text = "";
    this.font = "12px Arial";
    this.hAlign = "center";
    this.vAlign = "middle";
    this.textColor = "#000";

    return this;
}

TGE.Text.prototype = {
    _mPreviousText : null,
    _mPreviousFont : null,

    /**
     * Initializes the basic properties of a Text object.
     * @param x {Number} The horizontal position of the text on the game canvas (in pixels).
     * @param y {Number} The vertical position of the text on the game canvas (in pixels).
     * @param text {String} The text to be displayed.
     * @param font {String} Indicates the font and style used for rendering the text. The string must be defined in the following sequence: formatting + font size + font name. For example, "10px Arial", "bold italic 28px Tahoma", etc.
     * @param hAlign {String} Indicates the desired horizontal alignment of the text. Accepted values are "left", "center", and "right".
     * @param vAlign {String} Indicates the desired vertical alignment of the text. Accepted values are "top", "middle", and "down".
     * @param color {String} The color to apply to the text. Accepts standard html font color attribute styles, ie: "red", "#f00", "#ff0000", "rgb(255,0,0)", etc.
     * @param layerID {String} The id of the layer to add the text object to. If not specified, the text will be added to the default back layer.
     * @return {TGE.Text}
     */
    Setup : function(x, y, text, font, hAlign, vAlign, color, layerID) {
        // Do the super setup
        TGE.ScreenEntity.prototype.Setup.call(this, x, y, null, layerID);

        this.text = text;
        this.font = font;
        this.hAlign = hAlign;
        this.vAlign = vAlign;
        this.textColor = color;

        return this;
    },

    /**
     * @ignore
     */
    _calculateDimensions : function(canvasContext) {
        canvasContext.save();

        canvasContext.font = this.font;
        var textDimensions = canvasContext.measureText(this.text);
        this.width = textDimensions.width;

        // Determine the height (this is not accurate - but it's not critical anyways)
        try {
            var pos = this.font.indexOf("px");
            var ss = this.font.substring(0, pos);
            this.height = parseInt(ss, 10);
            this.height += (this.height / 4) >> 0;
        } catch(e) {
            this.height = 30;
        }

        canvasContext.restore();
    },

    /**
     * @ignore
     */
    _drawClass : function(canvasContext) {
        // Anything to draw?
        if (this.text === null) {
            return;
        }

        // If the font or text changed, recalculate the dimensions
        if (this._mPreviousText !== this.text || this._mPreviousFont !== this.font) {
            this._mPreviousText = this.text;
            this._mPreviousFont = this.font;
            this._calculateDimensions(canvasContext);
        }

        // Load the text properties
        canvasContext.font = this.font !== null ? this.font : "Arial";
        canvasContext.textAlign = this.hAlign !== null ? this.hAlign : "center";
        canvasContext.textBaseline = this.vAlign !== null ? this.vAlign : "middle";
        canvasContext.fillStyle = this.textColor !== null ? this.textColor : "#000";

        // Draw the text
        canvasContext.fillText(this.text, 0, 0);
    }
}
extend(TGE.Text, TGE.ScreenEntity);
/**
 * @class Similar to a ScreenEntity except that it is positioned in world space and viewed via the game's camera. Subsequently the screen position of a GameWorldEntity is relative to the location of the game camera.
 * @constructor
 * @extends TGE.ScreenEntity
 */
TGE.GameWorldEntity = function(game) {
    TGE.ScreenEntity.call(this, game);

    this.worldPosition = new TGE.Point();
}

TGE.GameWorldEntity.prototype = {
    _mLockXPosition : false,

    /**
     * Initializes the basic properties of a ScreenEntity object.
     * @param x {Number} The horizontal position of the object in the game world.
     * @param y {Number} The vertical position of the object in the game world.
     * @param [imageID] {String} The id of the image used to represent this object. If an image is set using this function it can only be a single frame (1x1 compound image).
     * @param [layerID] {String} The id of the layer to add this object to. If not specified, the object will be added to the default back layer.
     * @return {TGE.ScreenEntity}
     */
    Setup : function(x, y, imageID, layerID) {
        this.mLayer = layerID;
        this.SetWorldPosition(x, y);
        this.setImage(this.mGame.GetImage(imageID));
        this.mGame.getLayer(this.mLayer).addChild(this);

        return this;
    },

    /**
     * Sets the position of the entity within world space.
     * @param x {Number} Desired x-coordinate of the entity in world space.
     * @param y {Number} Desired y-coordinate of the entity in world space.
     */
    SetWorldPosition : function(x, y) {
        this.worldPosition.x = x;
        this.worldPosition.y = y;
    },

    /**
     * Each side of the viewport can be flagged such that if the entity moves beyond that side, it will be flagged for removal from the game.
     * Useful for side-scrolling or launch style games where objects are no longer needed once they move off screen in a particular direction.
     * @param top {Boolean} If set to true the entity will be flagged for removal if it moves beyond the top of the visible viewing area.
     * @param right {Boolean} If set to true the entity will be flagged for removal if it moves past the right side of the visible viewing area.
     * @param bottom {Boolean} If set to true the entity will be flagged for removal if it moves below the bottom of the visible viewing area.
     * @param left {Boolean} If set to true the entity will be flagged for removal if it moves past the left side of the visible viewing area.
     */
    CullToCamera : function(top, right, bottom, left) {
        // If a side is set to true, the object will be removed from the
        // scene as soon as it passes out of the camera's view on that side
        this._mCameraCulling = [top, right, bottom, left];
    },

    /**
     * Returns the coordinates of the entity within the game world.
     * @return {Vector} A 2D Sylvester vector object.
     */
    WorldPosition : function() {
        return this.mWorldPosition;
    },

    /* This function's behavior is probably too specific to be documented as a core feature */
    /** @ignore */
    LockXPosition : function() {
        this._mLockXPosition = true;
    },

    /** @ignore */
    _updateScreenPosition : function() {
        // Update the screen position
        var x = this._mLockXPosition ? this.worldPosition.x : this.mGame.ScreenX(this.worldPosition.x);
        var y = this.mGame.ScreenY(this.worldPosition.y);
        this.x = x;
        this.y = y;
    }
}
extend(TGE.GameWorldEntity, TGE.ScreenEntity, null);
/**
 * @class A class used to represent a UI screen within the game, ie: main menu, pause screen, game over screen, etc.
 * @param game {@link TGE.ScreenManager} The ScreenManager object that manages this screen.
 * @constructor
 */
TGE.Screen = function(screenManager) {
    this.mScreenManager = screenManager;
    this.mBackground = null;
    this.mUIElements = new Array();
    this.mDestroyed = false;
}

TGE.Screen.prototype = {

    Setup : function() {
        // Override to setup your screen
    },

    Close : function() {
        this.mScreenManager.CloseScreen(this.constructor);
    },

    Game : function() {
        return this.mScreenManager.Game();
    },

    CreateUIEntity : function(classType) {
        var obj = this.mScreenManager.CreateUIEntity(classType);
        this.mUIElements.push(obj);

        return obj;
    },

    DisplayNumber : function(number, x, y, image, spacing, alignment, useCommas, layer) {
        var host = this.CreateUIEntity(TGE.ScreenEntity).Setup(x, y, null, layer);

        var numberString = number.toString();
        var commaSpacing = 24;
        var commaTweak = 2;
        var stringWidth = numberString.length * spacing;

        // Add commas to stringWidth
        if (useCommas) {
            var numCommas = Math.floor((numberString.length - 1) / 3);
            stringWidth += numCommas * commaSpacing;
            stringWidth -= numCommas * commaTweak;
        }

        var iconX = alignment == "center" ? stringWidth / 2 + spacing / 2 : stringWidth;
        iconX -= spacing;
        var iconY = 0;

        var c = 0;
        for ( i = numberString.length - 1; i >= 0; i--) {
            // Do we need a comma?
            if (useCommas && c == 3) {
                iconX += commaTweak;
                var comma = new TGE.Sprite();
                comma.setImage("big_digits_comma");
                comma.x = iconX;
                comma.y = iconY;
                host.addChild(comma);
                iconX -= commaSpacing;
                c = 0;
            }

            var digit = new TGE.Sprite();
            digit.setImage(image, 1, 10);
            digit.setSpriteIndex(numberString.charCodeAt(i) - 48);
            digit.x = iconX;
            digit.y = iconY;
            host.addChild(digit);

            iconX -= spacing;
            c++;
        }

        return host;
    },

    FillBackground : function(color) {
        this.mBackground = this.mScreenManager.Game().CreateUIEntity(TGE.ScreenEntity);
        this.mBackground.Setup(0, 0, null, this.mScreenManager.mLayerName);
        this.mBackground.registrationX = 0;
        this.mBackground.registrationY = 0;
        this.mBackground.width = this.mScreenManager.Game().Width();
        this.mBackground.height = this.mScreenManager.Game().Height();
        this.mBackground.backgroundColor = color;
    },

    Finalize : function() {

    },

    ShowAll : function() {
        for (var i = 0; i < this.mUIElements.length; i++) {
            this.mUIElements[i].Show();
        }
    },

    HideAll : function() {
        for (var i = 0; i < this.mUIElements.length; i++) {
            this.mUIElements[i].Hide();
        }
    },

    Update : function(elapsedTime) {

    },

    Destroy : function() {
        // Remove the background
        if (this.mBackground != null) {
            this.mBackground.markForRemoval();
        }

        // Remove any UI objects
        for (var i = 0; i < this.mUIElements.length; i++) {
            // Tell the object to destroy itself
            this.mUIElements[i].markForRemoval();
        }

        this.mDestroyed = true;
    }
}/**
 * @class A high level class for managing UI screens within a game.
 * @param game {@link TGE.Game} The game instance that the ScreenManager is for.
 * @constructor
 */
TGE.ScreenManager = function(game) {
    this.mGame = game;
    this.mLayerName = "ScreenManager";
    this.mScreens = new Array();
    this.mFadeIn = null;
    this.mFadeInAlpha = 1;
    this.mFadeInSpeed = 1;
    this.mFadeInColor = null;
}

TGE.ScreenManager.prototype = {

    Initialize : function(game) {
        // Destroy any existing screens
        for (var screen in this.mScreens) {
            if (this.mScreens[screen] != null) {
                this.mScreens[screen].Destroy();
                this.mScreens[screen] = null;
            }
        }

        game.CreateLayer(this.mLayerName);
        game.CreateLayer("FadeOverlay");
    },

    setupFadeIn : function(color, speed) {
        this.mFadeInSpeed = speed;
        this.mFadeInColor = color;
    },

    CreateUIEntity : function(classType) {
        return this.mGame.CreateUIEntity(classType);
    },

    ShowScreen : function(classType, doFade) {
        var newScreen = new classType;
        classType.prototype.constructor.apply(newScreen, [this]);

        var screenName = classType["className"] ? classType.className() : classType.name;
        this.mScreens[screenName] = newScreen;

        newScreen.Setup();
        newScreen.Finalize();

        doFade = typeof doFade === "undefined" ? true : doFade;
        if (doFade != false) {
            this.ResetFade();
        }

        return newScreen;
    },

    CloseScreen : function(classType) {
        // Find it
        var screenName = classType["className"] ? classType.className() : classType.name;
        var screen = this.mScreens[screenName];
        if (screen == null) {
            return;
        }

        screen.Destroy();
        this.mScreens[classType] = null;
    },

    ResetFade : function() {
        if (this.mFadeInColor !== null) {
            // Setup the fade object if it doesn't exist yet
            if (this.mFadeIn === null) {
                this.mFadeIn = new TGE.DisplayObject();
                this.mFadeIn.width = this.mGame.Width();
                this.mFadeIn.height = this.mGame.Height();
                this.mFadeIn.registrationX = 0;
                this.mFadeIn.registrationY = 0;
                this.mFadeIn.backgroundColor = this.mFadeInColor;
                this.mGame.getLayer("FadeOverlay").addChild(this.mFadeIn);
            }

            // Make sure the child is still in the scene
            if (this.mGame.getLayer("FadeOverlay").getChildIndex(this.mFadeIn) === -1) {
                this.mGame.getLayer("FadeOverlay").addChild(this.mFadeIn);
            }

            this.mFadeInAlpha = 1;
            this.mFadeIn.alpha = 1;
            this.mFadeIn.visible = true;
        }
    },

    Update : function(elapsedTime) {
        if (this.mFadeIn !== null && this.mFadeInColor !== null) {
            this.mFadeInAlpha -= elapsedTime / this.mFadeInSpeed;
            if (this.mFadeInAlpha <= 0) {
                this.mFadeInAlpha = 0;
                this.mFadeIn.visible = false;
            }
            this.mFadeIn.alpha = this.mFadeInAlpha;
        }

        // Update all the screens
        for (var screen in this.mScreens) {
            if (this.mScreens[screen] != null) {
                this.mScreens[screen].Update(elapsedTime);
            }
        }
    },

    Game : function() {
        return this.mGame;
    },

    XFromPercentage : function(p) {
        return this.mGame.Width() * p;
    },

    YFromPercentage : function(p) {
        return this.mGame.Height() * p;
    },

    FixedDistanceFromTop : function(d) {
        return d;
    },

    FixedDistanceFromBottom : function(d) {
        return this.mGame.Height() - d;
    },

    FixedDistanceFromLeft : function(d) {
        return d;
    },

    FixedDistanceFromRight : function(d) {
        return this.mGame.Width() - d;
    }
}/**
 <p>The TGE.Analytics class provides functions you can call to track metrics in your game.
 Analytic events are filtered down using the following dimensions: <i>game name, event category, event name,</i> and an optional <i>event value</i>.
 A TGE.Analytics function exists for logging in each of the pre-defined categories: <i>game, level, achievement, share, clickthru, error</i> and <i>custom</i>.
 If you are building your game off of the {@link TGE.Game} class, many important events are automatically tracked for you.
 The events handled by {@link TGE.Game} are as follows:</p>
 <ul>
 <li><strong>game: load</strong> - triggered as soon as initial asset loading is complete, the value is the load time in seconds.</li>
 <li><strong>game: begin</strong> - triggered when {@link TGE.Game#PlayGame} is called.</li>
 <li><strong>game: pause</strong> - triggered when the game is paused by {@link TGE.Game#PauseGame}.</li>
 <li><strong>game: resume</strong> - triggered when the game is un-paused by {@link TGE.Game#PauseGame}.</li>
 <li><strong>game: end</strong> - triggered when {@link TGE.Game#EndGame} is called.</li>
 </ul>
 <ul>
 <li><strong>level: start</strong> - triggered when {@link TGE.Game#StartLevel} is called and the level is different from the last level played.</li>
 <li><strong>level: complete</strong> - triggered when {@link TGE.Game#FinishLevel} is called.</li>
 <li><strong>level: replay</strong> - triggered when {@link TGE.Game#Replay} is called or {@link TGE.Game#StartLevel} and the level is the same as the last level played.</li>
 </ul>
 <ul>
 <li><strong>clickthru: url</strong> - triggered anytime {@link TGE.Game#OpenURL} is used.</li>
 </ul>
 <ul>
 <li><strong>error: no canvas</strong> - triggered when the platform does not support an HTML5 2D canvas.</li>
 </ul>
 <p>To activate the default analytics listed above in a {@link TGE.Game} subclass, assign the {@link TGE.Game#analytics} property to an instance of TGE.Analytics or one of its subclasses.
 This should be done as early as possible, ideally in the game's constructor:</p>
 <pre class="prettyprint linenums">
 MyGame = function()
 {
 MyGame.superclass.constructor.call(this);

 // Create the analytics object
 this.analytics = new TGE.Analytics("My Game Name");

 ...
 }
 </pre>
 <p>The base TGE.Analytics class does not actually submit events to an analytics service, it will only log them to the console for testing.
 To track events for a live game, use a valid TGE.Analytics subclass such as {@link TGE.GoogleAnalytics}</p>
 <p><i>NOTE: if your game is making use of the {@link TGE.Game} level handling functionality,
 the level number will be appended to the game name dimension. For example if your game is called "Fungame" and the user is on level 3,
 the event will log the game name as "Fungame - level 3".</i></p>

 * @class
 * @param {String} gameName The name of the game to be used in the analytic events.
 * @constructor
 */
TGE.Analytics = function(gameName) {
    this.gameName = gameName;

    return this;
};

TGE.Analytics.prototype = {
    /**
     * Logs an analytic event in the <strong>game</strong> category.
     * @param {String} eventName The name of the analytic event. Examples are <i>load, begin, end, pause, resume</i>, etc.
     * @param {Number} [level=null] Optional level number if applicable.
     * @param {String|Number} [value] Optional value associated with the event.
     */
    logGameEvent : function(eventName, level, value) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if ((eventName == "pause" || eventName == "resume") && level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: game, " + eventName + ", " + gameName;

        // Load event logs time
        if (eventName == "load" || eventName == "end") {
            str += (", " + value.toString());
        }

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>share</strong> category.
     * @param {String} eventName The name of the analytic event. Examples could be <i>twitter, facebook, email</i>, etc.
     * @param {Number} [level=null] Optional level number if applicable.
     */
    logShareEvent : function(eventName, level) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if (level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: share, " + eventName + ", " + gameName;

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>level</strong> category.
     * @param {String} eventName The name of the analytic event. Examples are <i>start, complete, replay</i>, etc.
     * @param {Number} level The current level number of the game.
     * @param {Number} duration The current duration of the game in seconds.
     */
    logLevelEvent : function(eventName, level, duration) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if (level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: level, " + eventName + ", " + gameName;

        // Complete and fail events log time
        if ((eventName == "complete" || eventName == "fail") && duration != null) {
            str += (", " + duration.toString());
        }

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>achievement</strong> category.
     * @param {String} achievementName The name of the achievement event. Examples could be <i>'game complete', 'new highscore'</i>, etc.
     * @param {Number} [level=null] Optional level number if applicable.
     * @param {String|Number} [value] Optional value associated with the event.
     */
    logAchievementEvent : function(achievementName, level, value) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if (level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: achievement, " + achievementName + ", " + gameName;

        // Log the value if present
        if (value != null) {
            str += (", " + value.toString());
        }

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>error</strong> category.
     * @param {String} errorEvent The name of the error event. Examples could be <i>'no canvas', 'invalid input', 'unknown'</i>, etc.
     */
    logErrorEvent : function(errorEvent) {
        var str = "ANALYTIC EVENT: error, " + errorEvent + ", " + this.gameName;

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>clickthru</strong> category.
     * @param {String} url The url the game was requested to open.
     * @param {Number} [level=null] Optional level number if applicable.
     */
    logClickThruEvent : function(url, level) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if (level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: clickthru, " + url + ", " + gameName;

        TGE.log(str);
    },

    /**
     * Logs an analytic event in the <strong>custom</strong> category.
     * @param {String} customLabel The name of any analytic event that does not logically fit into the pre-defined categories.
     * @param {Number} [level=null] Optional level number if applicable.
     * @param {String|Number} [value] Optional value associated with the event.
     */
    logCustomEvent : function(customLabel, level, value) {
        // Append the level number to the game name if applicable
        var gameName = this.gameName;
        if (level != null && level > 0) {
            gameName += (" - level " + level.toString());
        };

        var str = "ANALYTIC EVENT: custom, " + customLabel + ", " + gameName;

        // Log the value if present
        if (value != null) {
            str += (", " + value.toString());
        }

        TGE.log(str);
    }
}/**
 <p>A Google Analytics implementation of the {@link TGE.Analytics} class.
 <p>For TGE.GoogleAnalytics to work you must first define a standard Google Analytics tag in your html document.
 For more information, view <a href="http://support.google.com/analytics/bin/answer.py?hl=en&answer=1008080">How to setup the web tracking code</a> on the Google Analytics support page.
 The TGE analytic event parameters map to the Google Analytics custom event dimensions as follows:
 <ul>
 <li>TGE game name &rarr; Google Analytics Event Label</li>
 <li>TGE event category &rarr; Google Analytics Event Category</li>
 <li>TGE event name &rarr; Google Analytics Event Action</li>
 <li>TGE event value &rarr; Google Analytics Event Value</li>
 </ul>
 <p>To activate Google Analytics tracking in a {@link TGE.Game} subclass, assign the {@link TGE.Game#analytics} property to an instance of TGE.GoogleAnalytics.
 This should be done as early as possible, ideally in the game's constructor:</p>
 <pre class="prettyprint linenums">
 MyGame = function()
 {
 MyGame.superclass.constructor.call(this);

 // Create the analytics object
 this.analytics = new TGE.GoogleAnalytics("My Game Name");

 ...
 }
 </pre>

 * @class
 * @param {String} gameName The name of the game to be used in the analytic events.
 * @extends TGE.Analytics
 */
TGE.GoogleAnalytics = function(gameName, id) {
    TGE.GoogleAnalytics.superclass.constructor.call(this, gameName);

    // If this is a PhoneGap build, initialize the PhoneGap GA plugin
    if (TGE.BrowserDetect.usingPhoneGap) {
        if (window.plugins && window.plugins.gaPlugin) {
            this._gaPlugin = window.plugins.gaPlugin;

            // The last parameter defines the posting interval. Currently set to every 10 seconds.
            this._gaPlugin.init(null, this._logError, id, 10);
        } else {
            TGE.log("***** ERROR: PhoneGap GoogleAnalytics plugin was not found");
        }
    }

    return this;
};

TGE.GoogleAnalytics.prototype = {
    _gaPlugin : null,

    /** @ignore (documented in superclass)*/
    logGameEvent : function(eventName, level, value) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if ((eventName == "pause" || eventName == "resume") && level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "game";
            var gaEvent = eventName;
            var gaLabel = gameName;
            var gaValue = value;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logShareEvent : function(eventName, level) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if (level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "share";
            var gaEvent = eventName;
            var gaLabel = gameName;
            var gaValue = null;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logLevelEvent : function(eventName, level, duration) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if (level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "level";
            var gaEvent = eventName;
            var gaLabel = gameName;
            var gaValue;

            // Complete and fail events log time
            if (eventName == "complete" || eventName == "fail" && duration != null) {
                gaValue = duration;
            }

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logAchievementEvent : function(achievementName, level, value) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if (level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "achievement";
            var gaEvent = achievementName;
            var gaLabel = gameName;
            var gaValue = value;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logErrorEvent : function(errorEvent) {
        try {
            var gaCategory = "error";
            var gaEvent = errorEvent;
            var gaLabel = this.gameName;
            var gaValue = null;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logClickThruEvent : function(url, level) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if (level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "clickthru";
            var gaEvent = url;
            var gaLabel = gameName;
            var gaValue = null;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    /** @ignore (documented in superclass)*/
    logCustomEvent : function(customLabel, level, value) {
        try {
            // Append the level number to the game name if applicable
            var gameName = this.gameName;
            if (level != null && level > 0) {
                gameName += (" - level " + level.toString());
            };

            var gaCategory = "custom";
            var gaEvent = customLabel;
            var gaLabel = gameName;
            var gaValue = value;

            this._trackEvent(gaCategory, gaEvent, gaLabel, gaValue);
        } catch(e) {
            this._logError(e.toString());
        }
    },

    _trackEvent : function(gaCategory, gaEvent, gaLabel, gaValue) {
        if (this._gaPlugin !== null) {
            // PhoneGap plugin requires -1 for 'no value'
            if ( typeof gaValue !== "number") {
                gaValue = -1;
            }
            this._gaPlugin.trackEvent(this._logResult, this._logError, gaCategory, gaEvent, gaLabel, gaValue);
        } else if (_gaq) {
            _gaq.push(['_trackEvent', gaCategory, gaEvent, gaLabel, gaValue]);
        }
    },

    _logError : function(errorMessage) {
        TGE.log('***** ERROR: TGE.GoogleAnalytics - ' + errorMessage);
    },

    _logResult : function(errorMessage) {
        //TGE.log('TGE.GoogleAnalytics - ' + errorMessage);
    }
}
extend(TGE.GoogleAnalytics, TGE.Analytics);
/**
 * @class A handy class to create looping background animations in side-scrolling games.
 * @param game {@link TGE.Game} The game instance that this object is a part of.
 * @extends TGE.ScreenEntity
 * @constructor
 */
TGE.ParallaxPane = function(game) {
    TGE.ParallaxPane.superclass.constructor.call(this, game);

    this.mTrackingSpeed = 1;
    this.mPane1 = null;
    this.mPane2 = null;
    this.mHorizontalOffset = 0;
    this.mWorldY = 0;
}

TGE.ParallaxPane.prototype = {

    Setup : function(oy, tracking, image, layer) {
        // Do the super setup (skipping the image setup)
        TGE.ScreenEntity.prototype.Setup.call(this, 0, 0, null, layer);
        this.mWorldY = oy;
        this.registrationX = 0;
        this.registrationY = 0;

        this.mTrackingSpeed = tracking;

        this.mPane1 = new TGE.Sprite();
        this.mPane1.setImage(this.mGame.GetImage(image));
        this.addChild(this.mPane1);
        this.mPane1.x = 0;
        this.mPane1.y = 0;
        this.mPane1.registrationX = 0;
        this.mPane1.registrationY = 0;

        this.mPane2 = new TGE.Sprite();
        this.mPane2.setImage(this.mGame.GetImage(image));
        this.addChild(this.mPane2);
        this.mPane2.x = this.mGame.Width();
        this.mPane2.y = 0;
        this.mPane2.registrationX = 0;
        this.mPane2.registrationY = 0;

        return this;
    },

    SetHorizontalOffset : function(x) {
        this.mHorizontalOffset = x;
    },

    /** @ignore */
    _updateScreenPosition : function() {
        var camX = this.mGame.CameraLocation().x;
        var px = (-camX + this.mHorizontalOffset) * this.mTrackingSpeed / this.scaleX;

        var width = this.mGame.Width() / this.scaleX;
        this.mPane1.x = px % width;
        this.mPane1.y = this.mGame.ScreenY(this.mWorldY);
        this.mPane2.x = this.mPane1.x + width;
        this.mPane2.y = this.mGame.ScreenY(this.mWorldY);
    }
}
extend(TGE.ParallaxPane, TGE.ScreenEntity);
/**
 * @class A handy class to create vertical scrolling background effects.
 * @param game {@link TGE.Game} The game instance that this object is a part of.
 * @extends TGE.ScreenEntity
 * @constructor
 */
TGE.VerticalParallaxPane = function(game) {
    TGE.VerticalParallaxPane.superclass.constructor.call(this, game);

    this.mTrackingSpeed = 1;
    this.mPane1 = null;
    this.mPane2 = null;
    this.mVerticalOffset = 0;
}

TGE.VerticalParallaxPane.prototype = {
    Setup : function(tracking, image, layer) {
        // Do the super setup
        TGE.ScreenEntity.prototype.Setup.call(this, 0, 0, null, layer);
        this.registrationX = 0;
        this.registrationY = 0;

        this.mTrackingSpeed = tracking;

        this.mPane1 = new TGE.Sprite();
        this.mPane1.setImage(this.mGame.GetImage(image));
        this.addChild(this.mPane1);
        this.mPane1.x = 0;
        this.mPane1.y = 0;
        this.mPane1.registrationX = 0;
        this.mPane1.registrationY = 0;

        this.mPane2 = new TGE.Sprite();
        this.mPane2.setImage(this.mGame.GetImage(image));
        this.addChild(this.mPane2);
        this.mPane2.x = 0;
        this.mPane2.y = this.mGame.Height();
        this.mPane2.registrationX = 0;
        this.mPane2.registrationY = 0;

        return this;
    },

    /** @ignore */
    _updateScreenPosition : function() {
        var camY = this.mGame.CameraLocation().y;
        var py = (camY + this.mVerticalOffset) * this.mTrackingSpeed / this.scaleY;

        var height = this.mGame.Height() / this.scaleY;
        this.mPane1.x = 0;
        this.mPane1.y = py % height;
        this.mPane2.x = 0;
        this.mPane2.y = this.mPane1.y - height;
    }
}
extend(TGE.VerticalParallaxPane, TGE.ScreenEntity);
/**
 <p>The TGE.Advertisement class contains information on an instance of an in-game advertising unit.
 Typically you would not create an instance of this class directly. To create a fullscreen modal overlay ad, use the static function {@link TGE.Advertisement.DisplayModalOverlayAd}.
 To add an individual ad unit to one of your own screens, use the static function {@link TGE.Advertisement.DisplayAd}.</p>

 * @param {Object} adParams Information about the advertisement.
 * @param {HTMLDivElement} adParams.element The DOM element that the advertisement is a child of.
 * @param {Function} [adParams.closeCallback=null] An optional callback function which is executed when the ad is removed.
 * @constructor
 */
TGE.Advertisement = function(adParams) {
    this.element = adParams.element === "undefined" ? null : adParams.element;
    this.closeCallback = adParams.closeCallback === "undefined" ? null : adParams.closeCallback;
};

TGE.Advertisement.prototype = {
    /**
     * Removes the ad and fires the close callback, if any.
     */
    close : function() {
        // Remove it
        if (this.element !== null && this.element.parentNode !== null) {
            this.element.parentNode.removeChild(this.element);
        }

        // Call the callback
        if (this.closeCallback !== null) {
            this.closeCallback.call();
        }
    }
}

// STATIC METHODS:

/**
 <p>The most basic ad type - displays the contents of a url (which contains the desired advertisement) into an iframe using the specified size and position.</p>
 <a href='http://jsbin.com/'>View a working sample with full source code...</a>

 * @param {Object} adParams Information about how the ad should be displayed.
 * @param {HTMLDivElement} adParams.parentDiv The div the advertisement should be displayed on (typically the game canvas).
 * @param {Number} adParams.adWidth The width of the advertisement in pixels.
 * @param {Number} adParams.adHeight The height of the advertisement in pixels.
 * @param {Function} [adParams.closeCallback=null] An optional callback function which can be executed when the ad is removed.
 * @return {TGE.Advertisment} The TGE.Advertisement instance that was created.
 */
TGE.Advertisement.DisplayAd = function(adParams) {
    var parentDiv = adParams.parentDiv;
    var adWidth = adParams.adWidth;
    var adHeight = adParams.adHeight;
    var x = typeof adParams.x === "undefined" ? (parentDiv.clientWidth - adWidth) / 2 : adParams.x;
    var y = typeof adParams.y === "undefined" ? (parentDiv.clientHeight - adHeight) / 2 : adParams.y;
    var closeCallback = typeof adParams.closeCallback === "undefined" ? null : adParams.closeCallback;

    // Setup the ad unit
    var adElement = null;

    // STR-172 Don't allow ads at all on Android 4.0.X native browsers
    if (TGE.BrowserDetect.platform === "Android" && TGE.BrowserDetect.browser === "Mozilla" && TGE.BrowserDetect.OSversion === "4.0") {
        // No ads due to STR-172 bug
        adElement = null;
    } else if (getDistributionPartner() === "A0009") {
        // Temporary hack - Kongregate does not allow ads
        adElement = null;
    } else {
        adElement = document.createElement("div");
        adElement.style.position = "absolute";
        adElement.style.zIndex = 3;
        adElement.style.left = x.toString() + "px";
        adElement.style.top = y.toString() + "px";
        adElement.style.width = adWidth.toString() + "px";
        adElement.style.height = adHeight.toString() + "px";
        adElement.style.overflow = "hidden";
        adElement.style.border = "none";
        parentDiv.insertBefore(adElement, parentDiv.firstChild);

        // Load the ad content
        //var cb = Math.floor(Math.random()*99999999999);
        adElement.innerHTML = "<object type='text/html' width='" + adWidth + "px' height='" + (adHeight + 4).toString() + "px' data='" + adParams.adURL/* +              "?cb="+cb*/+"'></object>";
    }

    return new TGE.Advertisement({
        element : adElement,
        closeCallback : closeCallback
    });
}
/**
 <p>Displays a modal popup containing a user specified ad unit.
 The ad creates a background covering the entire game screen that blocks all input below it.
 A user must click one of two available close buttons on the overlay to close the ad and resume the game.</p>
 <a href='http://jsbin.com/'>View a working sample with full source code...</a>

 * @param {Object} adParams Information about how the ad should be displayed.
 * @param {HTMLDivElement} adParams.parentDiv The div the advertisement overlay should be completely covering (typically the game canvas).
 * @param {String} adParams.adURL The URL from which the actual advertisement will be loaded. The page the URL leads to should be setup as a basic html page containing just the desired ad tag. The css style of the page body should be set to: "margin:0px; overflow: hidden;"
 * @param {Number} adParams.adWidth The width of the actual advertisement in pixels.
 * @param {Number} adParams.adHeight The height of the actual advertisement in pixels.
 * @param {Function} [adParams.closeCallback=null] An optional callback function which can be executed when the user closes the ad overlay.
 * @param {Number} [adParams.skipDelay=0] Indicates the desired time in seconds for the ad overlay's close/resume buttons to be supressed. A value of 0 or less means the close/resume buttons will be immediately available.
 * @param {String} [adParams.headerText="This game sponsored by:"] The text that should be displayed directly above the ad unit.
 * @param {Number} [adParams.overlayRed=1] The red component of the desired color of the modal overlay. Range 0-1.
 * @param {Number} [adParams.overlayGreen=1] The green component of the desired color of the modal overlay. Range 0-1.
 * @param {Number} [adParams.overlayBlue=1] The blue component of the desired color of the modal overlay. Range 0-1.
 * @param {Number} [adParams.overlayOpacity=1] A value indicating the desired opacity of the modal overlay. Range from 0 (transparent) to 1 (opaque).
 */
TGE.Advertisement.DisplayModalOverlayAd = function(adParams) {
    var parentDiv = adParams.parentDiv;
    var adWidth = adParams.adWidth;
    var adHeight = adParams.adHeight;
    var skipDelay = typeof adParams.skipDelay === "undefined" ? 0 : adParams.skipDelay;
    var adHeaderText = typeof adParams.headerText === "undefined" ? "This game sponsored by:" : adParams.headerText;
    var overlayRed = typeof adParams.overlayRed === "undefined" ? 1 : adParams.overlayRed;
    var overlayGreen = typeof adParams.overlayGreen === "undefined" ? 1 : adParams.overlayGreen;
    var overlayBlue = typeof adParams.overlayBlue === "undefined" ? 1 : adParams.overlayBlue;
    var overlayOpacity = typeof adParams.overlayOpacity === "undefined" ? 1 : adParams.overlayOpacity;
    var closeCallback = typeof adParams.closeCallback === "undefined" ? null : adParams.closeCallback;

    // STR-172 Don't allow ads at all on Android 4.0.X native browsers
    if (TGE.BrowserDetect.platform === "Android" && TGE.BrowserDetect.browser === "Mozilla" && TGE.BrowserDetect.OSversion === "4.0") {
        // No ads due to STR-172 bug - fire the close callback in case something is waiting on it
        if (closeCallback !== null) {
            closeCallback.call();
        }
        return;
    }

    // Temporary hack - Kongregate does not allow ads
    if (getDistributionPartner() === "A0009") {
        if (closeCallback !== null) {
            closeCallback.call();
        }
        return;
    }

    // Overlay
    var overlayDiv = document.createElement("div");
    overlayDiv.id = "ad_overlay";
    overlayDiv.style.zIndex = 3;
    overlayDiv.style.position = "absolute";
    overlayDiv.style.width = parentDiv.clientWidth + "px";
    overlayDiv.style.height = parentDiv.clientHeight + "px";
    overlayDiv.style.backgroundColor = "rgba(" + Math.round(overlayRed * 255).toString() + "," + Math.round(overlayGreen * 255).toString() + "," + Math.round(overlayBlue * 255).toString() + "," + overlayOpacity.toString() + ")";
    parentDiv.insertBefore(overlayDiv, parentDiv.firstChild);

    // Close button
    var closeDiv = null;
    if ( typeof adParams.closeButton === "string") {
        var buttonSize = 30;
        closeDiv = document.createElement("div");
        closeDiv.id = "tge_ad_close_button";
        closeDiv.style.position = "absolute";
        closeDiv.style.display = "none";
        var top = Math.round(parentDiv.clientWidth * 0.0156);
        var left = parentDiv.clientWidth - top - buttonSize;
        closeDiv.style.top = top.toString() + "px";
        closeDiv.style.left = left.toString() + "px";
        closeDiv.innerHTML = "<img src='" + adParams.closeButton + "'>";
        closeDiv.style.cursor = "pointer";
        overlayDiv.insertBefore(closeDiv, overlayDiv.firstChild);
    }

    // Resume button
    var buttonSize = 30;
    var resumeDiv = document.createElement("div");
    resumeDiv.id = "tge_ad_resume_button";
    resumeDiv.style.position = "absolute";
    resumeDiv.style.display = "none";
    var top = Math.round(parentDiv.clientHeight * 0.904);
    var left = (parentDiv.clientWidth - (300 + 2)) / 2;
    resumeDiv.style.top = top.toString() + "px";
    resumeDiv.style.left = left.toString() + "px";
    resumeDiv.style.width = "300px";
    resumeDiv.style.marginLeft = "auto";
    resumeDiv.style.marginRight = "auto";
    resumeDiv.style.textAlign = "center";
    resumeDiv.style.paddingTop = "6px";
    resumeDiv.style.paddingBottom = "6px";
    resumeDiv.style.backgroundColor = "#f00";
    resumeDiv.style.border = "solid 1px #444";
    resumeDiv.style.borderRadius = "5px";
    resumeDiv.style.color = "#fff";
    resumeDiv.style.fontSize = "17px";
    resumeDiv.style.fontWeight = "bold";
    resumeDiv.innerHTML = "Resume Game Play";
    resumeDiv.style.cursor = "pointer";
    overlayDiv.insertBefore(resumeDiv, overlayDiv.firstChild);

    // Setup the close/resume button hooks
    var clickEvent = TGE.BrowserDetect.isMobileDevice ? "touchstart" : "click";
    if (closeDiv !== null) {
        closeDiv.addEventListener(clickEvent, TGE.Advertisement._CloseAd.bind(this, overlayDiv, closeCallback), false);
    }
    resumeDiv.addEventListener(clickEvent, TGE.Advertisement._CloseAd.bind(this, overlayDiv, closeCallback), false);

    // Either show the close button now, or later if a delay was requested
    if (skipDelay > 0) {
        setTimeout(TGE.Advertisement._ShowOverlayCloseButtons.bind(this, overlayDiv), skipDelay * 1000);
    } else {
        TGE.Advertisement._ShowOverlayCloseButtons(overlayDiv);
    }

    // Setup a click/mouse handlers to block input from going through to the parent div
    overlayDiv.addEventListener("click", TGE.Advertisement._BlockEvent, false);
    overlayDiv.addEventListener("mousedown", TGE.Advertisement._BlockEvent, false);
    overlayDiv.addEventListener("mouseup", TGE.Advertisement._BlockEvent, false);
    overlayDiv.addEventListener("mousemove", TGE.Advertisement._BlockEvent, false);

    // Ad unit
    var adDiv = document.createElement("div");
    adDiv.id = "ad_div";
    adDiv.style.position = "absolute";
    var top = (parentDiv.clientHeight - (adHeight + 70)) / 2;
    adDiv.style.top = top.toString() + "px";
    adDiv.style.marginLeft = "auto";
    adDiv.style.marginRight = "auto";
    adDiv.style.width = "100%";
    adDiv.style.overflow = "hidden";
    adDiv.style.color = "#333";
    adDiv.style.fontSize = "20px";
    adDiv.style.fontWeight = "bold";
    adDiv.style.textAlign = "center";
    overlayDiv.insertBefore(adDiv, overlayDiv.firstChild);

    // Load the ad content
    //var cb = Math.floor(Math.random()*99999999999);
    adDiv.innerHTML = "<div style='padding-bottom: 15px;'>" + adHeaderText + "</div>" + "<object type='text/html' width='" + adWidth + "px' height='" + (adHeight + 4).toString() + "px' data='" + adParams.adURL/* +              "?cb="+cb*/+"'></object>" + "<div style='color: #666; font-size: 10px; font-weight: normal; padding-left: " + (adWidth - 72).toString() + "px;'>Advertisement</div>";
}
/**
 * Displays a modal popup ad unit using a child webkit view on PhoneGap native builds.
 * The ad creates a background covering the entire game screen that blocks all input below it.
 * Close/resume buttons will be immediately available.
 * @param {String} adParams.adURL The URL from which the actual advertisement will be loaded. The page the URL leads to should be setup as a basic html page containing just the desired ad tag. The css style of the page body should be set to: "margin:0px; overflow: hidden;"
 * @param {Function} [adParams.closeCallback=null] An optional callback function which can be executed when the user closes the ad overlay.
 */
TGE.Advertisement.DisplayChildBrowserAd = function(adParams) {
    window.plugins.childBrowser.onClose = adParams.closeCallback;
    window.plugins.childBrowser.showWebPage(adParams.adURL, {
        showLocationBar : true,
        showAddress : false,
        showNavigationBar : true
    });
}

TGE.Advertisement._CloseAd = function(adDiv, closeCallback, e) {
    // Remove the div and it's children
    adDiv.parentNode.removeChild(adDiv);

    // Call the callback
    if (closeCallback !== null) {
        closeCallback.call();
    }
}

TGE.Advertisement._ShowOverlayCloseButtons = function(overlayDiv) {
    var closeButton = document.getElementById("tge_ad_close_button");
    if (closeButton != null) {
        closeButton.style.display = "block";
    }

    var resumeButton = document.getElementById("tge_ad_resume_button");
    if (resumeButton != null) {
        resumeButton.style.display = "block";
    }
}

TGE.Advertisement._BlockEvent = function(e) {
    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    return false;
}
TGE.Achievement = function(id, name, description, imageID) {
    this._id = id;
    this._earned = false;

    this.name = name;
    this.description = description;
    this.imageID = imageID;

    return this;
}

TGE.Achievement.prototype = {
    _id : null,

    earned : function() {
        this._earned = true;
    },

    hasBeenEarned : function() {
        return this._earned;
    },

    id : function() {
        return this._id;
    }
}

TGE.Achievements = function() {
    this.lockedIconID = null;
    this.earnedAchievementCallback = null;

    return this;
}

TGE.Achievements.prototype = {
    _achievements : [],
    _achievementIDs : [],

    createAchievement : function(id, name, description, imageID) {
        this._achievements[id] = new TGE.Achievement(id, name, description, imageID);
        this._achievementIDs.push(id);
    },

    saveCompletedAchievements : function() {
        // For now we're using a cookie
        var achString = "";
        var len = this._achievementIDs.length;
        for (var a = 0; a < len; a++) {
            var ach = this.getAchievementAt(a);
            if (ach.hasBeenEarned()) {
                achString += a;
                achString += " ";
            }
        }

        // Now make it non-obvious what the string represents to prevent easy hacking
        var string2 = "";
        len = achString.length;
        for ( c = 0; c < len; c++) {
            if (achString.charAt(c) === " ") {
                string2 += Math.floor(Math.random() * 10).toString();
            } else {
                string2 += String.fromCharCode(achString.charCodeAt(c) + 50);
            }
        }

        // Save to a cookie
        if (string2.length > 0) {
            var exdate = new Date();
            var exdays = 999;
            exdate.setDate(exdate.getDate() + exdays);
            var c_value = string2 + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
            document.cookie = "tgeachv1" + "=" + c_value;
        }
    },

    loadCompletedAchievements : function() {
        // For now we're using a cookie
        var achString = null;
        var i, x, y, ARRcookies = document.cookie.split(";");
        for ( i = 0; i < ARRcookies.length; i++) {
            x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
            y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
            x = x.replace(/^\s+|\s+$/g, "");
            if (x == "tgeachv1") {
                achString = y;
            }
        }

        // Did we get anything?
        if (achString) {
            var actualString = "";
            len = achString.length;
            for ( c = 0; c < len; c++) {
                var test = achString.charCodeAt(c);
                if (achString.charCodeAt(c) <= 57) {
                    actualString += " ";
                } else {
                    actualString += String.fromCharCode(achString.charCodeAt(c) - 50);
                }
            }

            var achs = actualString.split(" ");
            for (var a = 0; a < achs.length; a++) {
                if (achs[a].length > 0) {
                    this.earnedAchievementAt(parseInt(achs[a]), true);
                }
            }
        }
    },

    clearAchievements : function() {
        // Save to a cookie
        var exdate = new Date();
        var exdays = 999;
        exdate.setDate(exdate.getDate() + exdays);
        var c_value = "" + ((exdays == null) ? "" : "; expires=" + exdate.toUTCString());
        document.cookie = "tgeachv1" + "=" + c_value;
    },

    numberOfAchievements : function() {
        return this._achievementIDs.length;
    },

    getAchievement : function(id) {
        return this._achievements[id];
    },

    getAchievementAt : function(i) {
        return this.getAchievement(this._achievementIDs[i]);
    },

    earnedAchievementAt : function(index, silent) {
        this.earnedAchievement(this._achievementIDs[index], silent);
    },

    earnedAchievement : function(id, silent) {
        silent = typeof silent === "undefined" ? false : silent;

        var ach = this._achievements[id];
        if (ach) {
            // Don't re-submit achievements internally
            if (!ach.hasBeenEarned()) {
                ach.earned();

                // Callback?
                if (!silent && this.earnedAchievementCallback) {
                    this.earnedAchievementCallback.call(null, ach);
                }

                // Submit to partner sites
                this._submitAchievementToPartner(ach);

                this.saveCompletedAchievements();
            }
        }
    },

    submitScore : function(score) {
        // Kongregate
        if (getDistributionPartner() === "A0009" && parent.kongregate) {
            parent.kongregate.stats.submit("highscore", score);
        }
        // DigYourOwnGrave
        else if (getDistributionPartner() === "A0010") {
            // Get user id from querystring
            var userID = parseInt(getQueryString()["user"]);
            var gameID = parseInt(getQueryString()["hid"]);
            if (!isNaN(userID) && !isNaN(gameID) && userID > 0 && gameID >= 0) {
                var key = Sha1.hash(gameID.toString() + score.toString() + "troisdixchix" + userID.toString());
                var url = "http://www.digyourowngrave.com/high_scores/exclusive/auto_submit_score.php?user_id=" + userID + "&game_id=" + gameID + "&score=" + score + "&key=" + key;

                // A little hack to silently make a php request
                var i = document.createElement("img");
                i.src = url;
            }
        }
        // iOS App
        else if (TGE.BrowserDetect.usingPhoneGap && TGE.BrowserDetect.oniOS) {
            // Submit to Game Center here...
        }
    },

    _submitAchievementToPartner : function(achievement) {
        if (achievement) {
            // Kongregate
            if (getDistributionPartner() === "A0009" && parent.kongregate) {
                parent.kongregate.stats.submit(achievement.id(), 1);
            }
            // DigYourOwnGrave
            else if (getDistributionPartner() === "A0010") {
                // Get user id and achievement id base from querystring
                var achivementIDBase = parseInt(getQueryString()["aid"]);
                var userID = parseInt(getQueryString()["user"]);
                if (!isNaN(achivementIDBase) && !isNaN(userID) && achivementIDBase >= 0 && userID > 0) {
                    var achIndex = this._achievementIDs.indexOf(achievement.id());
                    if (achIndex >= 0) {
                        var dyogAchievementID = achivementIDBase + achIndex;
                        var key = Sha1.hash(dyogAchievementID.toString() + "troisdixchix" + userID.toString());
                        var url = "http://www.digyourowngrave.com/high_scores/exclusive/auto_submit_achievement.php?user_id=" + userID + "&achievement=" + dyogAchievementID + "&key=" + key;

                        // A little hack to silently make a php request
                        var i = document.createElement("img");
                        i.src = url;
                    }
                }
            }
            // iOS App
            else if (TGE.BrowserDetect.usingPhoneGap && TGE.BrowserDetect.oniOS) {
                // Submit to Game Center here...
            }

        }
    }
}
/**
 * TreSensa Game Engine- PlatForm Identification Messages
 * code snippet  from: http://modernizr.com/downloads/modernizr-2.5.3.js
 */

/**@class
 This class confirms whether a particular HTML5 feature is supported or not. Object can be created as follows:

 var objPlatformCompatibility  =  new TGE.PlatformCompatibility()
 */

TGE.PlatformCompatibility = function() {
    return this;
};

TGE.PlatformCompatibility.prototype = {
    /**
     This method returns whether the HTML5 audio tag is supported by the browser.

     @returns {bool}
     True: If the audio tag is supported.
     False: If audio tag is not supported.

     @example
     var bCheck =   objPlatformCompatibility.isAudioSupported();
     */
    isAudioSupported : function() {

        var elem = document.createElement('audio'), bool = false;

        try {
            if ( bool = !!elem.canPlayType) {
                bool = new Boolean(bool);
                bool.ogg = elem.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, '');
                bool.mp3 = elem.canPlayType('audio/mpeg;').replace(/^no$/, '');

                // Mimetypes accepted:
                //   developer.mozilla.org/En/Media_formats_supported_by_the_audio_and_video_elements
                //   bit.ly/iphoneoscodecs
                bool.wav = elem.canPlayType('audio/wav; codecs="1"').replace(/^no$/, '');
                bool.m4a = (elem.canPlayType('audio/x-m4a;') || elem.canPlayType('audio/aac;')).replace(/^no$/, '');
            }
        } catch(e) {
        }

        return bool;

    },

    /**
     This method determines whether the given audio format is supported on a particular platform.

     @param sFormat {string} The following values are supported “ogg”, "mp3", "wav", "m4a"

     @returns {bool}
     True: If the specified format is supported.
     False: If the specified format is not supported.

     @example
     var bCheck =  objPlatformCompatibility.isAudioFormatSupported("ogg");
     */
    isAudioFormatSupported : function(sFormat) {

        var elem = document.createElement('audio'), bool = false;
        var returnV

        try {
            if ( bool = !!elem.canPlayType) {
                bool = new Boolean(bool);
                switch(sFormat) {
                    case "ogg":
                        returnV = elem.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, '');
                        break;
                    case "mp3":
                        returnV = elem.canPlayType('audio/mpeg;').replace(/^no$/, '');
                        break;
                    case "wav":
                        returnV = elem.canPlayType('audio/wav; codecs="1"').replace(/^no$/, '');
                        break;
                    case "m4a":
                        returnV = (elem.canPlayType('audio/x-m4a;') || elem.canPlayType('audio/aac;')).replace(/^no$/, '');
                        break;
                    default:

                        break;
                }
                // Mimetypes accepted:
                //   developer.mozilla.org/En/Media_formats_supported_by_the_audio_and_video_elements
                //   bit.ly/iphoneoscodecs

            }
        } catch(e) {
        }

        return returnV;

    },

    /**
     Confirms whether canvas is supported on a particular  platform or not.

     @returns {bool}
     True:If canvas feature is supported.
     False: If canvas feature is not supported.

     @example
     var bCheck = objTGEPlatformCompatibility.isCanvasSupported();
     */
    isCanvasSupported : function() {

        var elem = document.createElement('canvas');
        return !!(elem.getContext && elem.getContext('2d'));
    },

    /**
     It returns whether video is supported on a particular  platform or not.

     @returns {bool}
     True: If the HTML5 video tag is supported by the browser.
     False If the HTML5 video tag is supported by the browser.

     @example
     var bCheck =  objPlatformCompatibility.isVideoSupported();
     */
    isVideoSupported : function() {
        var elem = document.createElement('video'), bool = false;

        // IE9 Running on Windows Server SKU can cause an exception to be thrown, bug #224
        try {
            if ( bool = !!elem.canPlayType) {
                bool = new Boolean(bool);
                bool.ogg = elem.canPlayType('video/ogg; codecs="theora"');

                bool.h264 = elem.canPlayType('video/mp4; codecs="avc1.42E01E"');

                bool.webm = elem.canPlayType('video/webm; codecs="vp8, vorbis"');
            }

        } catch(e) {
        }

        return bool;

    },

    /** @ignore */
    isDragAndDropSupported : function() {

        var div = document.createElement('div');
        bool = ('draggable' in div) || ('ondragstart' in div && 'ondrop' in div);
        return bool;
    },

    /** @ignore */
    isGeolocationSupported : function() {
        return !!navigator.geolocation;

    },

    /** @ignore */
    isWebGlSupported : function() {
        try {
            var canvas = document.createElement('canvas'), ret;
            ret = !!(window.WebGLRenderingContext && (canvas.getContext('experimental-webgl') || canvas.getContext('webgl')));
            canvas = undefined;
        } catch (e) {
            ret = false;
        }
        return ret;

    },

    /** @ignore */
    isHistorySupported : function() {
        return !!(window.history && history.pushState);

    },

    /** @ignore */
    isVideoSupported : function() {
        var elem = document.createElement('video'), bool = false;
    },

    /** @ignore */
    isLocalStorageSupported : function() {
        try {
            localStorage.setItem(mod, mod);
            localStorage.removeItem(mod);
            return true;
        } catch(e) {
            return false;
        }

    },

    /** @ignore */
    isSessionStorageSupported : function() {
        try {
            sessionStorage.setItem(mod, mod);
            sessionStorage.removeItem(mod);
            return true;
        } catch(e) {
            return false;
        }

    },

    /** @ignore */
    isSVGSupported : function() {
        ns = {
            'svg' : 'http://www.w3.org/2000/svg'
        };
        return !!document.createElementNS && !!document.createElementNS(ns.svg, 'svg').createSVGRect;

    }
}

/**
 * TreSensa Game Engine- PlatForm Identification Messages
 * code snippet  from: http://modernizr.com/downloads/modernizr-2.5.3.js
 */

/**@class
 This class detects the orientation change and triggers the callback function. Object can be created as follows:

 var objDeviceOrientation  =  new TGE.DeviceOrientation()
 */
TGE.DeviceOrientation = function() {
    return this;
};

TGE.DeviceOrientation.prototype = {
    orientationChangeCallBack : null,

    /**
     This method  registers the callback and whenever the orientation of device is changed it triggers the callbackfunction

     @returns
     callback function

     @example
     function detectChangeInOrientation(mode)
     {
     switch(mode)
     {
     case 'portrait':
     break;
     case 'landscape':
     break;
     }
     }
     objDeviceOrientation.RegisterOrientationChange(detectChangeInOrientation);
     */
    RegisterOrientationChange : function(callback) {
        TGE.DeviceOrientation.prototype.orientationChangeCallBack = callback;
        window.addEventListener("orientationchange", TGE.DeviceOrientation.prototype.internalOrientationChanged)
        TGE.DeviceOrientation.prototype.internalOrientationChanged();

    },
    /** @ignore */
    internalOrientationChanged : function() {
        if (window.orientation === 90 || window.orientation === -90) {
            TGE.DeviceOrientation.prototype.orientationChangeCallBack("landscape");
        } else {
            TGE.DeviceOrientation.prototype.orientationChangeCallBack("portrait");
        }
    }
}/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  SHA-1 implementation in JavaScript | (c) Chris Veness 2002-2010 | www.movable-type.co.uk      */
/*   - see http://csrc.nist.gov/groups/ST/toolkit/secure_hashing.html                             */
/*         http://csrc.nist.gov/groups/ST/toolkit/examples.html                                   */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var Sha1 = {};
// Sha1 namespace

/**
 * Generates SHA-1 hash of string
 *
 * @param {String} msg                String to be hashed
 * @param {Boolean} [utf8encode=true] Encode msg as UTF-8 before generating hash
 * @returns {String}                  Hash of msg as hex character string
 */
Sha1.hash = function(msg, utf8encode) {
    utf8encode = ( typeof utf8encode == 'undefined') ? true : utf8encode;

    // convert string to UTF-8, as SHA only deals with byte-streams
    if (utf8encode)
        msg = Utf8.encode(msg);

    // constants [§4.2.1]
    var K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

    // PREPROCESSING

    msg += String.fromCharCode(0x80);
    // add trailing '1' bit (+ 0's padding) to string [§5.1.1]

    // convert string msg into 512-bit/16-integer blocks arrays of ints [§5.2.1]
    var l = msg.length / 4 + 2;
    // length (in 32-bit integers) of msg + ‘1’ + appended length
    var N = Math.ceil(l / 16);
    // number of 16-integer-blocks required to hold 'l' ints
    var M = new Array(N);

    for (var i = 0; i < N; i++) {
        M[i] = new Array(16);
        for (var j = 0; j < 16; j++) {// encode 4 chars per integer, big-endian encoding
            M[i][j] = (msg.charCodeAt(i * 64 + j * 4) << 24) | (msg.charCodeAt(i * 64 + j * 4 + 1) << 16) | (msg.charCodeAt(i * 64 + j * 4 + 2) << 8) | (msg.charCodeAt(i * 64 + j * 4 + 3));
        } // note running off the end of msg is ok 'cos bitwise ops on NaN return 0
    }
    // add length (in bits) into final pair of 32-bit integers (big-endian) [§5.1.1]
    // note: most significant word would be (len-1)*8 >>> 32, but since JS converts
    // bitwise-op args to 32 bits, we need to simulate this by arithmetic operators
    M[N-1][14] = ((msg.length - 1) * 8) / Math.pow(2, 32);
    M[N-1][14] = Math.floor(M[N-1][14])
    M[N-1][15] = ((msg.length - 1) * 8) & 0xffffffff;

    // set initial hash value [§5.3.1]
    var H0 = 0x67452301;
    var H1 = 0xefcdab89;
    var H2 = 0x98badcfe;
    var H3 = 0x10325476;
    var H4 = 0xc3d2e1f0;

    // HASH COMPUTATION [§6.1.2]

    var W = new Array(80);
    var a, b, c, d, e;
    for (var i = 0; i < N; i++) {

        // 1 - prepare message schedule 'W'
        for (var t = 0; t < 16; t++)
            W[t] = M[i][t];
        for (var t = 16; t < 80; t++)
            W[t] = Sha1.ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);

        // 2 - initialise five working variables a, b, c, d, e with previous hash value
        a = H0;
        b = H1;
        c = H2;
        d = H3;
        e = H4;

        // 3 - main loop
        for (var t = 0; t < 80; t++) {
            var s = Math.floor(t / 20);
            // seq for blocks of 'f' functions and 'K' constants
            var T = (Sha1.ROTL(a, 5) + Sha1.f(s, b, c, d) + e + K[s] + W[t]) & 0xffffffff;
            e = d;
            d = c;
            c = Sha1.ROTL(b, 30);
            b = a;
            a = T;
        }

        // 4 - compute the new intermediate hash value
        H0 = (H0 + a) & 0xffffffff;
        // note 'addition modulo 2^32'
        H1 = (H1 + b) & 0xffffffff;
        H2 = (H2 + c) & 0xffffffff;
        H3 = (H3 + d) & 0xffffffff;
        H4 = (H4 + e) & 0xffffffff;
    }

    return Sha1.toHexStr(H0) + Sha1.toHexStr(H1) + Sha1.toHexStr(H2) + Sha1.toHexStr(H3) + Sha1.toHexStr(H4);
}
//
// function 'f' [§4.1.1]
//
Sha1.f = function(s, x, y, z) {
    switch (s) {
        case 0:
            return (x & y) ^ (~x & z);
        // Ch()
        case 1:
            return x ^ y ^ z;
        // Parity()
        case 2:
            return (x & y) ^ (x & z) ^ (y & z);
        // Maj()
        case 3:
            return x ^ y ^ z;
        // Parity()
    }
}
//
// rotate left (circular left shift) value x by n positions [§3.2.5]
//
Sha1.ROTL = function(x, n) {
    return (x << n) | (x >>> (32 - n));
}
//
// hexadecimal representation of a number
//   (note toString(16) is implementation-dependant, and
//   in IE returns signed numbers when used on full words)
//
Sha1.toHexStr = function(n) {
    var s = "", v;
    for (var i = 7; i >= 0; i--) {
        v = (n >>> (i * 4)) & 0xf;
        s += v.toString(16);
    }
    return s;
}
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Utf8 class: encode / decode between multi-byte Unicode characters and UTF-8 multiple          */
/*              single-byte character encoding (c) Chris Veness 2002-2010                         */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */

var Utf8 = {};
// Utf8 namespace

/**
 * Encode multi-byte Unicode string into utf-8 multiple single-byte characters
 * (BMP / basic multilingual plane only)
 *
 * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars
 *
 * @param {String} strUni Unicode string to be encoded as UTF-8
 * @returns {String} encoded string
 */
Utf8.encode = function(strUni) {
    // use regular expressions & String.replace callback function for better efficiency
    // than procedural approaches
    var strUtf = strUni.replace(/[\u0080-\u07ff]/g, // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
    function(c) {
        var cc = c.charCodeAt(0);
        return String.fromCharCode(0xc0 | cc >> 6, 0x80 | cc & 0x3f);
    });
    strUtf = strUtf.replace(/[\u0800-\uffff]/g, // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
    function(c) {
        var cc = c.charCodeAt(0);
        return String.fromCharCode(0xe0 | cc >> 12, 0x80 | cc >> 6 & 0x3F, 0x80 | cc & 0x3f);
    });
    return strUtf;
}
/**
 * Decode utf-8 encoded string back into multi-byte Unicode characters
 *
 * @param {String} strUtf UTF-8 string to be decoded back to Unicode
 * @returns {String} decoded string
 */
Utf8.decode = function(strUtf) {
    // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
    var strUni = strUtf.replace(/[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g, // 3-byte chars
    function(c) {// (note parentheses for precence)
        var cc = ((c.charCodeAt(0) & 0x0f) << 12) | ((c.charCodeAt(1) & 0x3f) << 6) | (c.charCodeAt(2) & 0x3f);
        return String.fromCharCode(cc);
    });
    strUni = strUni.replace(/[\u00c0-\u00df][\u0080-\u00bf]/g, // 2-byte chars
    function(c) {// (note parentheses for precence)
        var cc = (c.charCodeAt(0) & 0x1f) << 6 | c.charCodeAt(1) & 0x3f;
        return String.fromCharCode(cc);
    });
    return strUni;
}
/**
 * @author sandeep_bamane
 */

var arrLoadingImages = [{
    id : 'splash_menu',
    url : 'code/images/common/splash_image.png'

}];

var arrGameImages = [{
    id : 'game_bg',
    url : 'code/images/common/oceanw_bg.png'
}, {
    id : '01_anim01',
    url : 'code/images/reel_objects/01_anim01.png'
}, {
    id : '02_anim01',
    url : 'code/images/reel_objects/02_anim01.png'
}, {
    id : '03_anim01',
    url : 'code/images/reel_objects/03_anim01.png'
}, {
    id : '04_anim01',
    url : 'code/images/reel_objects/04_anim01.png'
}, {
    id : '05_anim01',
    url : 'code/images/reel_objects/05_anim01.png'
}, {
    id : '06_anim01',
    url : 'code/images/reel_objects/06_anim01.png'
}, {
    id : '07_anim01',
    url : 'code/images/reel_objects/07_anim01.png'
}, {
    id : '08_anim01',
    url : 'code/images/reel_objects/08_anim01.png'
}, {
    id : '09_anim01',
    url : 'code/images/reel_objects/09_anim01.png'
}, {
    id : '10_anim01',
    url : 'code/images/reel_objects/10_anim01.png'
}, {
    id : '11_anim01',
    url : 'code/images/reel_objects/11_anim01.png'
}, {
    id : '12_anim01',
    url : 'code/images/reel_objects/12_anim01.png'
}, {
    id : '13_anim01',
    url : 'code/images/reel_objects/13_anim01.png'
}, {
    id : 'main_menu',
    url : 'code/images/common/main_menu_screen.png'

}, {
    id : 'botbg_int_norm',
    url : 'code/images/game_elements/Auto-Start-1-Main.png'
}, {
    id : 'btn_normal',
    url : 'code/images/game_elements/Auto-Start-1-normal-button.png'
}, {
    id : 'btn_hover',
    url : 'code/images/game_elements/Auto-Start-1-hover-button.png'
}, {
    id : 'spin_btn',
    url : 'code/images/game_elements/RollButton.png'
}, {
    id : 'botbg_int_norm_background',
    url : "code/images/game_elements/botbg_int_norm_background.png"
}, {
    id : 'winlineall_9',
    url : "code/images/common/winlineall_9.png"
}, {
    id : 'paylines',
    url : "code/images/game_elements/paylines.png"
}, {
    id : 'arrow_l',
    url : "code/images/game_elements/arrow_l.png"
}, {
    id : 'arrow_r',
    url : "code/images/game_elements/arrow_r.png"
}, {
    id : 'paytable_btn',
    url : "code/images/game_elements/paytable.png"
}, {
    id : 'paytable_bg',
    url : "code/images/game_elements/paytable_bg.png"
}, {
    id : 'paytable_close_btn',
    url : "code/images/game_elements/paytable_close.png"
}, {
    id : 'back_to_portal',
    url : "code/images/game_elements/back_to_portal.png"
}
];

var gAudioFiles = [{
    id : "reelstop",
    url : "code/audio/reelstop.mp3",
    backup_url : "code/audio/reelstop.ogg",
    assetType : "audio"
}, {
    id : "anim_started",
    url : "code/audio/melody1.mp3",
    backup_url : "code/audio/melody1.ogg",
    assetType : "audio"
}]

var SoundsToPreload_ForiOS = {
    reelstop : {
        url : "code/audio/reelstop.mp3"
    },
    anim_started : {
        url : "code/audio/melody1.mp3"
    },
    totalAudios : ["reelstop", "anim_started"]
}

function getRandomArbitary(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}/**

 * @author sandeep_bamane
 */

MainMenu.prototype = new TGE.Screen();
MainMenu.prototype.constructor = MainMenu;

function MainMenu(screenManager) {
    TGE.Screen.call(this, screenManager);
    return this;
}

MainMenu.prototype = {

    Setup : function() {
        this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "main_menu", this.playGame.bind(this), 1, this.mScreenManager.mLayerName);
        /*if (this.Game().mDeviceInfo == "Android") {
         console.log('main menu');
         this.Game().initAudio()
         }*/

    },
    playGame : function() {
        if (this.Game().mDeviceInfo == "iPad" || this.Game().mDeviceInfo == "iPhone") {
            this.Game().initAudio()
        }
        this.Game().StartPlaying();
    }
};
extend(MainMenu, TGE.Screen, null);
/**
 * @author sandeep_bamane
 */

LoadingScreen = function(screenManager) {
    TGE.Screen.call(this, screenManager);
    this.mLoadingText = null;
    this.lastDrawnKey = 0;
    return this;

}
LoadingScreen.prototype = {
    Setup : function() {
        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "splash_menu");
        this.mLoadingText = this.CreateUIEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "LOADING 0%", "24px Arial bold", "center", "middle", "black");
    },
    UpdateProgress : function(percentComplete) {
        var key = Math.round(percentComplete * 100);
        //var loadingText =
        this.mLoadingText.text = "LOADING..." + key.toString() + "%";
    }
}
extend(LoadingScreen, TGE.Screen, null);
/**
 * @author sandeep_bamane
 */

var GameContainer = function() {

    TGE.Game.call(this);
    this.rollButton = null;

    // array for collection of Elements
    this.arrReelObject = new Array();
    //total reel objects
    this.TOTAL_REEL_OBJECTS = 15
    this.ANIM_STOP = 36;
    this.startYFix = 0;

    this.arrCol1 = new Array();
    this.bAnim1 = false
    this.actualFinalArray_Col1 = new Array();

    this.arrCol2 = new Array();
    this.bAnim2 = false
    this.actualFinalArray_Col2 = new Array();

    this.arrCol3 = new Array();
    this.bAnim3 = false
    this.actualFinalArray_Col3 = new Array();

    this.arrCol4 = new Array();
    this.bAnim4 = false
    this.actualFinalArray_Col4 = new Array();

    this.arrCol5 = new Array();
    this.bAnim5 = false
    this.actualFinalArray_Col5 = new Array();

    this.animationStartSnd = null;
    this.reelStopedSnd = null;

    this.mDeviceInfo = TGE.BrowserDetect.platform;
    this.videoState = 0;

    this.mAutoSpinEnabledTimer = 0;
    this.mAutoSpinTimeCounter = 5;
    this.spinComplete = true;
    this.textAnimation = 0;
    this.mPaylineCounter = 2;

    this.mTotalBetCounter = 1;
    this.arrBetValue = [1, 10, 20, 40, 80, 100, 200, 400, 800, 1600];
    this.mTotalPotBalance = 600;
    this.mCurrentSpinBalance = 0;

    if (this.mDeviceInfo != "iPad" && this.mDeviceInfo != "iPhone" && this.mDeviceInfo != "Android") {
        arrGameImages = arrGameImages.concat(gAudioFiles)
    } else {
        this.ANIM_STOP = 46;
        if (this.mDeviceInfo != "Android") {
            this.animationStartSnd = new Howl({
                urls : ['code/audio/melody1.mp3', 'code/audio/melody1.ogg']
            });
            this.reelStopedSnd = new Howl({
                urls : ['code/audio/reelstop.mp3', 'code/audio/reelstop.ogg']
            });
        } else {
            // append video tag
            var vidElement = document.createElement('video');
            vidElement.setAttribute("preload", "auto");
            vidElement.setAttribute("id", 'static_video_audio_hack');
            vidElement.setAttribute("type", "audio/mpeg");
            vidElement.setAttribute("src", 'code/audio/for_ios.mp3');
            vidElement.setAttribute("height", '0px');

            document.getElementById('viewporter').appendChild(vidElement);
            vidElement.style.visibility = 'hidden'
            vidElement.addEventListener('timeupdate', this.videoProgress.bind(this), false);

            this.animationStartSnd = vidElement;
            this.animationStartSnd.play();
            this.animationStartSnd.pause();

        }
    }

    //pre-loading of assets
    this.assetManager.assignImageAssetList("loading", arrLoadingImages);
    this.assetManager.assignImageAssetList("required", arrGameImages);

}
GameContainer.prototype = {

    subclassStartPlaying : function() {
        // Clear everything in the scene
        this.ClearScene();

        // Fill the background in with white
        this.SetBackgroundColor("#FFF");

       /* this.arrCol1 = this.createOneColumn(1);
        this.nTotalRound1 = 4;

        this.arrCol2 = this.createOneColumn(2);
        this.nTotalRound2 = 6;

        this.arrCol3 = this.createOneColumn(3);
        this.nTotalRound3 = 8;

        this.arrCol4 = this.createOneColumn(4);
        this.nTotalRound4 = 10;

        this.arrCol5 = this.createOneColumn(5);
        this.nTotalRound4 = 12;

		*/
        this.createSurrounding();

    },
    videoProgress : function() {
        console.log(this.videoState + " :: " + this.animationStartSnd.currentTime)
        if (this.videoState == 3 || this.videoState == 1) {
            if (this.animationStartSnd.currentTime > 2)
                this.animationStartSnd.currentTime = 0;

        } else if (this.videoState == 2) {

            if (this.animationStartSnd.currentTime > 4.2) {
                this.videoState = 3
                this.animationStartSnd.currentTime = 0;
                this.animationStartSnd.play()
            }
        }

    },
    audioManipulation : function(bValue, id) {
        switch(id) {
            case 'anim_started':
                if (bValue) {
                    if (this.mDeviceInfo != "iPad" && this.mDeviceInfo != "iPhone" && this.mDeviceInfo != "Android") {
                        this.audioManager.Play({
                            id : "anim_started",
                            loop : "0"
                        });

                    } else {
                        this.videoState = 1
                        this.animationStartSnd.currentTime = 0;
                        this.animationStartSnd.play()

                    }
                } else {
                    if (this.mDeviceInfo != "iPad" && this.mDeviceInfo != "iPhone" && this.mDeviceInfo != "Android") {
                        this.audioManager.Pause('anim_started')
                    } else if (this.mDeviceInfo == "Android") {
                        this.videoState = 5
                    } else if (this.mDeviceInfo == "iPad" && this.mDeviceInfo == "iPhone") {
                        this.animationStartSnd.stop()
                    }
                }
                break;
            case 'reelstop':
                if (this.mDeviceInfo != "Android") {
                    if (this.mDeviceInfo != "iPad" && this.mDeviceInfo != "iPhone") {
                        this.audioManager.Play({
                            id : "reelstop",
                            loop : "0"
                        });
                    } else {
                        this.reelStopedSnd.play()
                    }
                } else {
                    this.videoState = 2
                    this.animationStartSnd.currentTime = 3.9;
                    this.animationStartSnd.play()
                }

                break;

        }

    },
    createSurrounding : function() {
		this.CreateSloats();
        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "game_bg", 'ui_elements')

        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.91), "botbg_int_norm_background", 'ui_elements')

        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.92), "botbg_int_norm", 'ui_elements');

        //		this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "winlineall_9", 'ui_elements');
              //= this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.23), this.mScreenManager.YFromPercentage(0.91), "btn_hover", null, 2, this.mScreenManager.mLayerName);
        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.06), this.mScreenManager.YFromPercentage(0.5), "paylines", 'ui_elements');
        this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.94), this.mScreenManager.YFromPercentage(0.5), "paylines", 'ui_elements');

        //this.rollButton1  = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.23), this.mScreenManager.YFromPercentage(0.91), "btn_hover", null, 2, this.mScreenManager.mLayerName);

        //this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.7), this.mScreenManager.YFromPercentage(0.89), "spin_btn", this.playGame.bind(this), 1, this.mScreenManager.mLayerName);
        this.rollButton = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.93), this.mScreenManager.YFromPercentage(0.91), "spin_btn", this.SpinButtonClicked.bind(this), 1, this.mScreenManager.mLayerName);
        this.rollButton.alpha = 0;
		//this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.93), this.mScreenManager.YFromPercentage(0.92), "btn_hover", null, 2, this.mScreenManager.mLayerName);
        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.93), this.mScreenManager.YFromPercentage(0.92), "START", "bold 18px Arial", "center", "middle", "#00000");

        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.793), this.mScreenManager.YFromPercentage(0.90), "LINES", "bold 18px Arial", "center", "middle", "#00000");
        this.mTotalPaylines = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.793), this.mScreenManager.YFromPercentage(0.95), "9", "bold 18px Arial", "center", "middle", "#00000");

        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.20), this.mScreenManager.YFromPercentage(0.90), "BET", "bold 18px Arial", "center", "middle", "#00000");
        this.mTotalBet = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.20), this.mScreenManager.YFromPercentage(0.95), "8", "bold 18px Arial", "center", "middle", "#00000");

        this.autoSpinText = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.07), this.mScreenManager.YFromPercentage(0.92), "AUTO", "bold 18px Arial", "center", "middle", "#00000");
        this.autoButton = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.07), this.mScreenManager.YFromPercentage(0.92), "spin_btn", this.autoPlayGame.bind(this), 1, this.mScreenManager.mLayerName);
        this.autoButton.alpha = 0;

        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.33), this.mScreenManager.YFromPercentage(0.91), "LAST WIN", "bold 15px Arial", "center", "middle", "#00000");
        this.mLastWinText = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.33), this.mScreenManager.YFromPercentage(0.94), "24", "bold 15px Arial", "center", "middle", "#00000");

        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.50), this.mScreenManager.YFromPercentage(0.90), "TOTAL BET", "bold 27px Arial", "center", "middle", "#00FF00");
        this.mGlobalBetForSpin = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.50), this.mScreenManager.YFromPercentage(0.95), "65", "bold 27px Arial", "center", "middle", "#00FF00");

        this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.67), this.mScreenManager.YFromPercentage(0.91), "BALANCE", "bold 15px Arial", "center", "middle", "#00000");
        this.mTotalPotBalanceText = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.67), this.mScreenManager.YFromPercentage(0.94), "24.950", "bold 15px Arial", "center", "middle", "#00000");

        this.winText = this.CreateWorldEntity(TGE.Text).Setup(this.mScreenManager.XFromPercentage(0.44), this.mScreenManager.YFromPercentage(0.44), "24.950", "bold 50px Arial", "center", "middle", "#00000");
        this.winText.text = " No Win"
        this.winText.visible = false;

        this.payline_right   = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.84), this.mScreenManager.YFromPercentage(0.87), "arrow_l", this.paylineArrowRight.bind(this), 1, this.mScreenManager.mLayerName);
      this.payline_left = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.84), this.mScreenManager.YFromPercentage(0.95), "arrow_r", this.paylineArrowLeft.bind(this), 1, this.mScreenManager.mLayerName);
        this.mTotalPaylines.text = this.mPaylineCounter;

       this.bet_right  = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.16), this.mScreenManager.YFromPercentage(0.87), "arrow_l", this.betArrowRight.bind(this), 1, this.mScreenManager.mLayerName);
        this.bet_left = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.16), this.mScreenManager.YFromPercentage(0.95), "arrow_r", this.betArrowLeft.bind(this), 1, this.mScreenManager.mLayerName);
        this.mTotalBet.text = this.arrBetValue[this.mTotalBetCounter];

        this.mGlobalBetForSpin.text = "" + (this.mPaylineCounter * this.arrBetValue[this.mTotalBetCounter])

        this.mLastWinText.text = "0";
        this.mTotalPotBalanceText.text = this.mTotalPotBalance;

        this.mBackToPortal = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.1), this.mScreenManager.YFromPercentage(0.07), "back_to_portal", this.backToPortalClicked.bind(this), 1, this.mScreenManager.mLayerName);
        this.mPayTableButton = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.92), this.mScreenManager.YFromPercentage(0.07), "paytable_btn", this.paytableButtonClicked.bind(this), 1, this.mScreenManager.mLayerName);
        this.paytableBG = this.CreateUIEntity(TGE.ScreenEntity).Setup(this.mScreenManager.XFromPercentage(0.5), this.mScreenManager.YFromPercentage(0.5), "paytable_bg", this.mScreenManager.mLayerName)
        this.mPayTableCloseButton = this.CreateUIEntity(TGE.Button).Setup(this.mScreenManager.XFromPercentage(0.92), this.mScreenManager.YFromPercentage(0.07), "paytable_close_btn", this.paytableCloseBtnClicked.bind(this), 1, this.mScreenManager.mLayerName);

        this.paytableBG.visible = false;
        this.mPayTableCloseButton.visible = false;
		
		this.updateTheBalances();
    },
    backToPortalClicked : function() {
        window.open("../index.html", "_self");
    },
    paytableButtonClicked : function() {
        var that = this;
        this.paytableBG.visible = true;
        this.paytableBG.alpha = 0;
        this.mPayTableCloseButton.visible = false;

        TweenLite.to(this.paytableBG, 1, {
            alpha : 1,
            onComplete : function() {
                that.mPayTableCloseButton.visible = true;

            }
        })
    },
    paytableCloseBtnClicked : function() {
        var that = this;
        that.mPayTableCloseButton.visible = false;
        TweenLite.to(this.paytableBG, 1, {
            alpha : 0,
            onComplete : function() {
                that.paytableBG.visible = false;
                that.paytableBG.alpha = 0;
                that.mPayTableCloseButton.visible = false;
            }
        })

    },
    betArrowLeft : function() {
        if (this.spinComplete) {
            this.mTotalBetCounter--;

            if (this.mTotalBetCounter <= 0) {
                this.mTotalBetCounter = 0;
                this.bet_left.visible = false;
            } else {
                this.bet_right.visible = true;
            }
            this.mTotalBet.text = this.arrBetValue[this.mTotalBetCounter];
            this.updateTheBalances();
        }

    },
    betArrowRight : function() {
        if (this.spinComplete) {
            this.mTotalBetCounter++;
            if (this.mTotalBetCounter >= 9) {
                this.mTotalBetCounter = 9;
                this.bet_right.visible = false;
            } else {
                this.bet_left.visible = true;
            }

            this.mTotalBet.text = this.arrBetValue[this.mTotalBetCounter];
            this.updateTheBalances();
        }

    },

    paylineArrowLeft : function() {

        if (this.spinComplete) {
            this.mPaylineCounter--;
            console.log('payline inc' + this.mPaylineCounter);
            if (this.mPaylineCounter <= 1) {
                this.mPaylineCounter = 1;
                this.payline_left.visible = false;
            } else {
                this.payline_right.visible = true;
            }

            this.mTotalPaylines.text = this.mPaylineCounter;
            this.updateTheBalances();
        }

    },
    updateTheBalances : function() {
        this.mCurrentSpinBalance = (this.mPaylineCounter * this.arrBetValue[this.mTotalBetCounter])
        this.mGlobalBetForSpin.text = "" + this.mCurrentSpinBalance
    },
    paylineArrowRight : function() {
        if (this.spinComplete) {
            this.mPaylineCounter++;
            if (this.mPaylineCounter >= 9) {
                this.mPaylineCounter = 9;
                this.payline_right.visible = false;
            } else {
                this.payline_left.visible = true;
            }

            this.mTotalPaylines.text = this.mPaylineCounter;
            this.updateTheBalances();
        }
    },
    checkWinCondition : function() {
        console.log(' CHECK WIN');
        //show animation of paylines
        this.winText.visible = true;
        this.mLastWinText.text = "0";
        var number = Math.floor(Math.random() * 101);
        if (number < 50) {
            // Code to show image
            this.winText.text = "NO WINs! Tray another Spin"
			 this.mTotalPotBalance -= this.mCurrentSpinBalance
            this.mLastWinText.text = this.mGlobalBetForSpin.text;
            this.mTotalPotBalanceText.text = this.mTotalPotBalance;
        } else {
            // Print the number
            this.winText.text = "WON THE PAYLINE!!"
            this.mTotalPotBalance += this.mCurrentSpinBalance
            this.mLastWinText.text = this.mGlobalBetForSpin.text;
            this.mTotalPotBalanceText.text = this.mTotalPotBalance;

        }

        this.winText.text = "WON THE PAYLINE!!"
        this.mLastWinText.text = this.mGlobalBetForSpin.text

        this.winText.alpha = 0;
        //this.textAnimation = setInterval(this.checkAutoSpin.bind(this),500)
        var that = this;
        TweenLite.to(this.winText, 1, {
            alpha : 1,
            onComplete : function() {
                that.animateAgain()
            }
        })

    },
    animateAgain : function() {
        var that = this;
        TweenLite.to(this.winText, 1, {
            alpha : 0,
            onComplete : function() {
                that.checkAutoSpin()
            }
        })
    },
    checkAutoSpin : function() {
        this.winText.visible = false;
        this.spinComplete = true;
        console.log(' Auto Spin check');
        if (this.mAutoSpinEnabledTimer === 1) {
            this.mAutoSpinTimeCounter--;
            this.autoSpinText.text = "SPIN COUNT " + this.mAutoSpinTimeCounter
            if (this.mAutoSpinTimeCounter > 0) {
                this.playGame();
            } else {
                this.autoSpinText.text = "AUTO"
            }
        }
    },

    autoPlayGame : function() {
        if (this.mAutoSpinEnabledTimer === 0) {
            this.mAutoSpinEnabledTimer = 1;
            this.autoSpinText.text = "SPIN COUNT " + this.mAutoSpinTimeCounter
            this.mAutoSpinTimeCounter = 5;
            this.playGame();
        } else {
            this.mAutoSpinEnabledTimer = 0;
            this.autoSpinText.text = "AUTO"

        }

    },
    SpinButtonClicked : function() {
        if (this.mAutoSpinEnabledTimer !== 1 && this.spinComplete) {
            this.playGame();
        }
    },

    playGame : function() {
        this.spinComplete = false;
        this.mGlobalBetForSpin.text = "" + (this.mPaylineCounter * this.arrBetValue[this.mTotalBetCounter])
        this.audioManipulation(true, 'anim_started')

		/*	
        this.nTotalRound1 = 4;
        this.nTotalRound2 = 5;
        this.nTotalRound3 = 6;
        this.nTotalRound4 = 7;
        this.nTotalRound5 = 8;

        for (var i = 0; i < 3; i++) {
            this.actualFinalArray_Col1[i].visible = false;
            this.actualFinalArray_Col2[i].visible = false;
            this.actualFinalArray_Col3[i].visible = false;
            this.actualFinalArray_Col4[i].visible = false;
            this.actualFinalArray_Col5[i].visible = false;
        }
        for (var i = 0; i < 13; i++) {
            this.arrCol1[i].visible = true;
            this.arrCol2[i].visible = true;
            this.arrCol3[i].visible = true;
            this.arrCol4[i].visible = true;
            this.arrCol5[i].visible = true;
        }

        this.bAnim1 = true;
        this.bAnim2 = true;
        this.bAnim3 = true;
        this.bAnim4 = true;
        this.bAnim5 = true;*/
		if (!this.isUpdateStart) {
            this.audioManipulation(true, 'anim_started')

            this.isUpdateStart = true;
            this.soundPlayerArray = [];
            this.timerFactor = [3,6,9,12,15];
            //this.timerFactor = [6.2,11,16,21,26.5];
        }

    },
    createOneColumn : function(nCol) {
        var nRandomNumber;
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        //var arrBaseX = new Array(0, 0.214, 0.35, 0.482, 0.616, 0.75);
        var arrBaseX = new Array(0, 0.199, 0.349, 0.501, 0.652, 0.803);

        var baseY = 0.704;
        var baseX = arrBaseX[nCol];
        var startX = this.mScreenManager.XFromPercentage(baseX);
        var startY = this.mScreenManager.YFromPercentage(baseY);
        this.startYFix = this.mScreenManager.YFromPercentage(baseY);
        var objectsCreated = new Array();
        for (var i = 0; i < 13; i++) {
            nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            objectsCreated[i] = this.CreateUIEntity(TGE.ScreenEntity).Setup(startX, startY, arrObjectName[nRandomNumber] + "_anim01", 'reel_objects')
            startY = startY - objectsCreated[i].height;
            //console.log(" nRandomNumber " + nRandomNumber + ' ::' + arrObjectName[nRandomNumber] + ' :: ' + arrObjectName)
            arrObjectName.splice(nRandomNumber, 1);
        }

        baseX = arrBaseX[nCol];
        startX = this.mScreenManager.XFromPercentage(baseX);
        startY = this.startYFix;
        arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this['actualFinalArray_Col'+nCol][i] = this.CreateUIEntity(TGE.ScreenEntity).Setup(startX, startY, arrObjectName[nRandomNumber] + "_anim01", 'reel_objects')
            startY = startY - 112
            this['actualFinalArray_Col'+nCol][i].visible = false;
            arrObjectName.splice(nRandomNumber, 1);
        }

        return objectsCreated;
    },
    resetColumnXY1 : function() {
        this.nTotalRound1--;
        if (this.nTotalRound1 > 0) {
            //	var arrBaseX = new Array(0, 0.2, 0.349, 0.501, 0.652, 0.803);
            var baseY = 0.704;
            var baseX = 0.2
            var startX = this.mScreenManager.XFromPercentage(baseX);
            var startY = this.mScreenManager.YFromPercentage(baseY);
            for (var i = 0; i < this.arrCol1.length; i++) {

                this.arrCol1[i].x = startX;
                this.arrCol1[i].y = startY;
                startY = startY - this.arrCol1[i].height;
            }
        } else {
            this.audioManipulation(true, 'reelstop')
            /*
             this.audioManager.Play({
             id : "reelstop",
             loop : "0"
             });*/
            this.bAnim1 = false;
            for (var i = 0; i < 13; i++) {
                this.arrCol1[i].visible = false;
            }
            this.showFinalValue1()

        }

    },
    showFinalValue1 : function() {
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            var nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this.actualFinalArray_Col1[i].SetImage(arrObjectName[nRandomNumber] + "_anim01");
            this.actualFinalArray_Col1[i].visible = true;
            arrObjectName.splice(nRandomNumber, 1);
        }
    },
    resetColumnXY2 : function() {
        this.nTotalRound2--;
        if (this.nTotalRound2 > 0) {
            var arrBaseX = new Array(0, 0.2, 0.349, 0.501, 0.652, 0.803);
            var baseY = 0.704;
            var baseX = arrBaseX[2];
            var startX = this.mScreenManager.XFromPercentage(baseX);
            var startY = this.mScreenManager.YFromPercentage(baseY);
            for (var i = 0; i < this.arrCol2.length; i++) {

                this.arrCol2[i].x = startX;
                this.arrCol2[i].y = startY;
                startY = startY - this.arrCol2[i].height;
            }
        } else {
            this.audioManipulation(true, 'reelstop')
            /*
             this.audioManager.Play({
             id : "reelstop",
             loop : "0"
             });*/
            this.bAnim2 = false;
            for (var i = 0; i < 13; i++) {
                this.arrCol2[i].visible = false;
            }
            this.showFinalValue2()

        }

    },
    showFinalValue2 : function() {
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            var nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this.actualFinalArray_Col2[i].SetImage(arrObjectName[nRandomNumber] + "_anim01");
            this.actualFinalArray_Col2[i].visible = true;
            arrObjectName.splice(nRandomNumber, 1);
        }
    },
    resetColumnXY3 : function() {
        this.nTotalRound3--;
        if (this.nTotalRound3 > 0) {
            var arrBaseX = new Array(0, 0.2, 0.349, 0.501, 0.652, 0.803);
            var baseY = 0.704;
            var baseX = arrBaseX[3];
            var startX = this.mScreenManager.XFromPercentage(baseX);
            var startY = this.mScreenManager.YFromPercentage(baseY);
            for (var i = 0; i < this.arrCol3.length; i++) {

                this.arrCol3[i].x = startX;
                this.arrCol3[i].y = startY;
                startY = startY - this.arrCol3[i].height;
            }
        } else {
            this.audioManipulation(true, 'reelstop')
            /*
             this.audioManager.Play({
             id : "reelstop",
             loop : "0"
             });*/
            this.bAnim3 = false;
            for (var i = 0; i < 13; i++) {
                this.arrCol3[i].visible = false;
            }
            this.showFinalValue3()

        }

    },
    showFinalValue3 : function() {
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            var nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this.actualFinalArray_Col3[i].SetImage(arrObjectName[nRandomNumber] + "_anim01");
            this.actualFinalArray_Col3[i].visible = true;
            arrObjectName.splice(nRandomNumber, 1);
        }
    },
    showFinalValue4 : function() {
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            var nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this.actualFinalArray_Col4[i].SetImage(arrObjectName[nRandomNumber] + "_anim01");
            this.actualFinalArray_Col4[i].visible = true;
            arrObjectName.splice(nRandomNumber, 1);
        }
    },

    resetColumnXY4 : function() {
        this.nTotalRound4--;
        if (this.nTotalRound4 > 0) {
            var arrBaseX = new Array(0, 0.2, 0.349, 0.501, 0.652, 0.803);
            var baseY = 0.704;
            var baseX = arrBaseX[4];
            var startX = this.mScreenManager.XFromPercentage(baseX);
            var startY = this.mScreenManager.YFromPercentage(baseY);
            for (var i = 0; i < this.arrCol4.length; i++) {

                this.arrCol4[i].x = startX;
                this.arrCol4[i].y = startY;
                startY = startY - this.arrCol4[i].height;
            }
        } else {
            this.audioManipulation(true, 'reelstop')
            //console.log('Stopp!!  [resetColumnXY4]');
            /*this.audioManager.Play({
             id : "reelstop",
             loop : "0"
             });*/
            this.bAnim4 = false;
            for (var i = 0; i < 13; i++) {
                this.arrCol4[i].visible = false;
            }
            this.showFinalValue4()

        }

    },
    resetColumnXY5 : function() {
        this.nTotalRound5--;
        if (this.nTotalRound5 > 0) {
            var arrBaseX = new Array(0, 0.2, 0.349, 0.501, 0.652, 0.803);
            var baseY = 0.704;
            var baseX = arrBaseX[5];
            var startX = this.mScreenManager.XFromPercentage(baseX);
            var startY = this.mScreenManager.YFromPercentage(baseY);
            for (var i = 0; i < this.arrCol4.length; i++) {

                this.arrCol5[i].x = startX;
                this.arrCol5[i].y = startY;
                startY = startY - this.arrCol5[i].height;
            }
        } else {
            this.audioManipulation(true, 'reelstop')
            /*this.audioManager.Play({
             id : "reelstop",
             loop : "0"
             });*/
            this.audioManipulation(false, 'anim_started')
            //this.audioManager.Pause('anim_started')
            this.bAnim5 = false;
            for (var i = 0; i < 13; i++) {
                this.arrCol5[i].visible = false;
            }
            this.showFinalValue5()

        }

    },
    showFinalValue5 : function() {
        var arrObjectName = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        for (var i = 0; i < 3; i++) {
            var nRandomNumber = getRandomArbitary(0, arrObjectName.length - 1);
            this.actualFinalArray_Col5[i].SetImage(arrObjectName[nRandomNumber] + "_anim01");
            this.actualFinalArray_Col5[i].visible = true;
            arrObjectName.splice(nRandomNumber, 1);
        }

        this.checkWinCondition();
    },
    initAudio : function() {
        if (this.mDeviceInfo == "Android") {

            var a = SoundsToPreload_ForiOS;
            this.audioManager = new AudioManagerForiOS(a)
        } else {
            if (this.mDeviceInfo == "iPad" || this.mDeviceInfo == "iPhone") {
                this.audioManager = new DummyAudioManger(this)
            }
        }
    },
    ResumeAllAudio : function() {

    },
    setupLayers : function() {
        this.CreateLayer("reel_objects");
        this.CreateLayer("ui_elements");

    },
    subclassMouseDown : function() {
    },
	CreateSloats:function () {
	var arrT = new Array('01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13');
        this.slotsArr = [];
        var diffX = 145, diffY = 112;
        var startX = 191 , startY = 155 - (diffY * 3);
        var num = 0;
        var repeatArr = [];
        var value = 0;
        for (var i = 0; i < 5; i++) {
            this.slotsArr[i] = [];
            for (var j = 0; j < 13; j++)
            {
                repeatArr = [];
                for (var j = 0; j < arrT.length; j++) {
                    num = Math.round(Math.random() * 12);
                    if(repeatArr.indexOf(num) == -1)
                    {
                        repeatArr.push(num);
                    }
                    else
                    {
                        j--;
                        continue;
                    }
                    this.slotsArr[i][j] = this.CreateUIEntity(TGE.ScreenEntity).Setup(startX+value + (i * diffX), startY + (j * diffY),arrT[num]+ "_anim01",'reel_objects');
                    //console.log((startY + (j * diffY)))
                }
            }
        }
    },
	
	subclassUpdateGame:function (elapsedTime) {
        if (this.isUpdateStart) {
            var timeStamp, yStamp, count = 0,done=false;
            var startY = -181, endY = 1163;
            var goInto = false;
            for (var i = 0; i < 5; i++) {
                timeStamp = this.timerFactor[i] -= 2 * elapsedTime;
                if (timeStamp > 0) {
                    yStamp = 100 * elapsedTime * timeStamp;
                    for (var j = 0; j < 13; j++) {
                        this.slotsArr[i][j].y += 20;
                        if (this.slotsArr[i][j].y > endY) {
                            this.slotsArr[i][j].y = startY -(endY-this.slotsArr[i][j].y);
                        }
                    }
                } else {
                    for (var j = 0; j < 13; j++) {
                        this.slotsArr[i][j].y =Math.round(this.slotsArr[i][j].y);

                        if((this.slotsArr[i][j].y - 40)% 112 != 0){
                            this.slotsArr[i][j].y =Math.round(this.slotsArr[i][j].y+=1);
                            done=true;
                            goInto = true;
                        }
                        if (this.slotsArr[i][j].y > endY) {
                            this.slotsArr[i][j].y = startY - (endY-this.slotsArr[i][j].y);
                        }

                        if(!goInto && this.soundPlayerArray.indexOf(i) == -1)
                        {
                            this.soundPlayerArray.push(i);
                            /*this.audioManager.Play({
                             id : "reelstop",
                             loop : "0"
                             });*/
                            this.audioManipulation(true, 'reelstop')
							 
                            if(this.soundPlayerArray.length >= 5)
                            {
							 this.audioManipulation(false, 'anim_started')
                                //this.audioManager.Pause('anim_started')

                            }
                        }

                    }
                    count++;

                }
            }
            if (count >= 5 && !done) {
				console.log('all done');
                this.isUpdateStart = false;
				this.checkWinCondition();
            }
        }
    },
	
    subclassUpdateGame_mine : function(elapsedTime) {

        if (this.bAnim1) {
            for (var i = 0; i < this.arrCol1.length; i++) {
                this.arrCol1[i].y += this.ANIM_STOP;
            }
            if (this.arrCol1[this.arrCol1.length - 5].y > (this.startYFix - 1)) {
                // console.log(' OHH FREAK '+this.arrCol1[this.arrCol1.length-1].y);
                this.arrCol1[this.arrCol1.length - 5].y = this.startYFix;
                this.arrCol1[this.arrCol1.length - 6].y = this.startYFix + 112;
                this.arrCol1[this.arrCol1.length - 7].y = this.startYFix + 112 * 2;
                this.resetColumnXY1();
                //break;
            }
        }

        if (this.bAnim2) {
            for (var i = 0; i < this.arrCol2.length; i++) {
                this.arrCol2[i].y += this.ANIM_STOP;
            }
            if (this.arrCol2[this.arrCol2.length - 5].y > (this.startYFix - 1)) {
                // console.log(' OHH FREAK '+this.arrCol1[this.arrCol1.length-1].y);
                this.arrCol2[this.arrCol2.length - 5].y = this.startYFix;
                this.arrCol2[this.arrCol2.length - 6].y = this.startYFix + 112;
                this.arrCol2[this.arrCol2.length - 7].y = this.startYFix + 112 * 2;
                this.resetColumnXY2();
                //break;
            }
        }

        if (this.bAnim3) {
            for (var i = 0; i < this.arrCol3.length; i++) {
                this.arrCol3[i].y += this.ANIM_STOP;
            }
            if (this.arrCol3[this.arrCol2.length - 5].y > (this.startYFix - 1)) {
                // console.log(' OHH FREAK '+this.arrCol1[this.arrCol1.length-1].y);
                this.arrCol3[this.arrCol2.length - 5].y = this.startYFix;
                this.arrCol3[this.arrCol2.length - 6].y = this.startYFix + 112;
                this.arrCol3[this.arrCol2.length - 7].y = this.startYFix + 112 * 2;
                this.resetColumnXY3();
                //break;
            }
        }

        if (this.bAnim4) {
            for (var i = 0; i < this.arrCol4.length; i++) {
                this.arrCol4[i].y += this.ANIM_STOP;
            }
            if (this.arrCol4[this.arrCol2.length - 5].y > (this.startYFix - 1)) {
                // console.log(' OHH FREAK '+this.arrCol1[this.arrCol1.length-1].y);
                this.arrCol4[this.arrCol2.length - 5].y = this.startYFix;
                this.arrCol4[this.arrCol2.length - 6].y = this.startYFix + 112;
                this.arrCol4[this.arrCol2.length - 7].y = this.startYFix + 112 * 2;
                this.resetColumnXY4();
                //break;
            }
        }

        if (this.bAnim5) {
            for (var i = 0; i < this.arrCol5.length; i++) {
                this.arrCol5[i].y += this.ANIM_STOP;
            }
            if (this.arrCol5[this.arrCol2.length - 5].y > (this.startYFix - 1)) {
                // console.log(' OHH FREAK '+this.arrCol1[this.arrCol1.length-1].y);
                this.arrCol5[this.arrCol2.length - 5].y = this.startYFix;
                this.arrCol5[this.arrCol2.length - 6].y = this.startYFix + 112;
                this.arrCol5[this.arrCol2.length - 7].y = this.startYFix + 112 * 2;
                this.resetColumnXY5();
                //break;
            }
        }

    },
    subclassEndGame : function() {
    }
}
extend(GameContainer, TGE.Game);

var AudioManagerForiOS = function(a) {
    console.log('FOR IAndroid');
    this.audioFileTracker = a;
    this.arrTrackAudioElementsName = new Array();
    this.arrTrackAudioElements = new Array();
    this.mDeviceInfo = TGE.BrowserDetect.platform;
    this.createAudioElement()
};
AudioManagerForiOS.prototype.createAudioElement = function() {
    this.arrTrackAudioElements = new Array();
    for (var a = 0; a < this.audioFileTracker.totalAudios.length; a++) {
        this.arrTrackAudioElementsName[a] = this.audioFileTracker.totalAudios[a];
        this.arrTrackAudioElements[a] = document.createElement("video");
        this.arrTrackAudioElements[a].setAttribute("preload", "auto");
        this.arrTrackAudioElements[a].setAttribute("id", this.arrTrackAudioElementsName[a]);
        this.arrTrackAudioElements[a].setAttribute("type", "audio/mpeg");
        this.arrTrackAudioElements[a].setAttribute("src", this.audioFileTracker[this.arrTrackAudioElementsName[a]].url);
        document.body.appendChild(this.arrTrackAudioElements[a]);

        this.arrTrackAudioElements[a].play();
        this.arrTrackAudioElements[a].pause()

    }
};
AudioManagerForiOS.prototype.Play = function(b) {
    var a = this.arrTrackAudioElements.indexOf(b.id);
    b.id = 'static_audio_video_element'
    console.log('FOR IAndroid PLAY :::' + document.getElementById(b.id));
    if (document.getElementById(b.id) != null) {
        if (document.getElementById(b.id).readyState != 0) {
            document.getElementById(b.id).currentTime = 0
        }
        document.getElementById(b.id).pause();
        document.getElementById(b.id).play()

        document.getElementById(b.id).addEventListener('ended', function() {
            console.log('FOR IAndroid PLAY ::ENDED:');

            document.getElementById(b.id).currentTime = 0;
        });
    }
};
AudioManagerForiOS.prototype.Pause = function(a) {
    if (document.getElementById(a) != null) {
        document.getElementById(a).pause()
    }
};
AudioManagerForiOS.prototype.Mute = function() {
};

var DummyAudioManger = function(b) {
    var a = {
        anim_started : [0, 2],
        reelstop : [3, 4]
    };
    this.mParent = b;
    this.mURL = "code/audio/for_ios.mp3";
    this.mAudio = new DeviatorAudioManager(this, a, this.mURL)
};
DummyAudioManger.prototype.audioLoadedCallBack = function(a) {
    this.mParent.ResumeAllAudio()
};
DummyAudioManger.prototype.Play = function(a) {
    this.mAudio.deviatorPlay(a.id)
};
DummyAudioManger.prototype.Pause = function(a) {
    this.mAudio.deviatorPause(a)
};
DummyAudioManger.prototype.Mute = function() {
};

var DeviatorAudioManager = function(d, b, a) {
    this.deviatorElement
    this.deviatorEND = 0;
    this.deviatorAllowed = false;
    this.deviatoralreadyInitialzed = false;
    this.deviatorParent = d;
    this.deviatorSprite = b;
    this.deviatorload(a)
};
DeviatorAudioManager.prototype.deviatorload = function(a) {
    if (!this.deviatoralreadyInitialzed) {
        this.deviatoralreadyInitialzed = true;
        this.deviatorElement = document.createElement("audio");
        this.deviatorElement.setAttribute("preload", "");
        this.deviatorElement.setAttribute("src", a);
        document.body.appendChild(this.deviatorElement);
        //console.log("## " + this.deviatorElement.src);
        var b = this;
        this.deviatorElement.addEventListener("loadeddata", function(d) {
            b.deviatorAllowed = true;
            if (b.deviatorParent != null) {
                b.deviatorParent.audioLoadedCallBack()
            }
        }, false);
        this.deviatorElement.addEventListener("timeupdate", function(d) {
            if (b.deviatorElement.currentTime > b.deviatorEND) {
                b.deviatorElement.pause()
            }
        }, false);
        this.deviatorElement.load()
    }
};
DeviatorAudioManager.prototype.deviatorload1 = function() {
    if (!this.deviatoralreadyInitialzed) {
        this.deviatoralreadyInitialzed = true;
        this.deviatorElement = document.querySelector("audio");
        var a = this;
        this.deviatorElement.addEventListener("loadeddata", function(b) {
            a.deviatorAllowed = true;
            if (a.deviatorParent != null) {
                a.deviatorParent.audioLoadedCallBack()
            }
        }, false);
        this.deviatorElement.addEventListener("timeupdate", function(b) {
            if (a.deviatorElement.currentTime > a.deviatorEND) {
                a.deviatorElement.pause()
            }
        }, false);
        this.deviatorElement.load()
    }
};
DeviatorAudioManager.prototype.deviatorPlay = function(a) {
    if (this.deviatorSprite[a] && this.deviatorAllowed) {
        this.deviatorElement.currentTime = this.deviatorSprite[a][0];
        this.deviatorEND = this.deviatorSprite[
        a][1];
        this.deviatorElement.play()
    }
};
DeviatorAudioManager.prototype.deviatorPause = function() {
    this.deviatorElement.pause()
};
/**
 * @author sandeep_bamane
 */

var mSlotGameInstance
function initializeTGE() {
    var mSlotGameInstance = new GameContainer();
    if (mSlotGameInstance.IsPlatformAcceptable()) {
        mSlotGameInstance.Launch({
            gameDiv : "game_canvas",
            orientation : "landscape",
            reorientDiv : "wrong_orientation"
        });

    }
}


window.addEventListener ? window.addEventListener("load", initializeTGE, false) : window.attachEvent && window.attachEvent("onload", initializeTGE);

