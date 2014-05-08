function PxLoader(d) {
	d = d || {};
	if (d.statusInterval == null) {
		d.statusInterval = 5000
	}
	if (d.loggingDelay == null) {
		d.loggingDelay = 20 * 1000
	}
	if (d.noProgressTimeout == null) {
		d.noProgressTimeout = Infinity
	}
	var h = [], a = [], n, c = +new Date;
	var k = {
		QUEUED : 0,
		WAITING : 1,
		LOADED : 2,
		ERROR : 3,
		TIMEOUT : 4
	};
	var l = function(o) {
		if (o == null) {
			return []
		}
		if (Array.isArray(o)) {
			return o
		}
		return [o]
	};
	this.add = function(o) {
		o.tags = new PxLoaderTags(o.tags);
		if (o.priority == null) {
			o.priority = Infinity
		}
		h.push({
			resource : o,
			status : k.QUEUED
		})
	};
	this.addProgressListener = function(p, o) {
		a.push({
			callback : p,
			tags : new PxLoaderTags(o)
		})
	};
	this.addCompletionListener = function(p, o) {
		a.push({
			tags : new PxLoaderTags(o),
			callback : function(q) {
				if (q.completedCount === q.totalCount) {
					p()
				}
			}
		})
	};
	var j = function(o) {
		o = l(o);
		var p = function(u) {
			var w = u.resource, t = Infinity;
			for (var s = 0; s < w.tags.length; s++) {
				for (var q = 0; q < Math.min(o.length, t); q++) {
					if (w.tags[s] == o[q] && q < t) {
						t = q;
						if (t === 0) {
							break
						}
					}
					if (t === 0) {
						break
					}
				}
			}
			return t
		};
		return function(s, q) {
			var u = p(s), t = p(q);
			if (u < t) {
				return -1
			}
			if (u > t) {
				return 1
			}
			if (s.priority < q.priority) {
				return -1
			}
			if (s.priority > q.priority) {
				return 1
			}
			return 0
		}
	};
	this.start = function(p) {
		n = +new Date;
		var q = j(p);
		h.sort(q);
		for (var s = 0, o = h.length; s < o; s++) {
			var t = h[s];
			t.status = k.WAITING;
			t.resource.start(this)
		}
		setTimeout(e, 100)
	};
	var e = function() {
		var t = false, u = (+new Date) - c, p = (u >= d.noProgressTimeout), q = (u >= d.loggingDelay);
		for (var s = 0, o = h.length; s < o; s++) {
			var w = h[s];
			if (w.status !== k.WAITING) {
				continue
			}
			if (w.resource.checkStatus) {
				w.resource.checkStatus()
			}
			if (w.status === k.WAITING) {
				if (p) {
					w.resource.onTimeout()
				} else {
					t = true
				}
			}
		}
		if (q && t) {
			f()
		}
		if (t) {
			setTimeout(e, d.statusInterval)
		}
	};
	this.isBusy = function() {
		for (var p = 0, o = h.length; p < o; p++) {
			if (h[p].status === k.QUEUED || h[p].status === k.WAITING) {
				return true
			}
		}
		return false
	};
	var m = function(q, z) {
		var y = null;
		for (var s = 0, w = h.length; s < w; s++) {
			if (h[s].resource === q) {
				y = h[s];
				break
			}
		}
		if (y == null || y.status !== k.WAITING) {
			return
		}
		y.status = z;
		c = +new Date;
		var o = q.tags.length;
		for (var s = 0, u = a.length; s < u; s++) {
			var p = a[s], t;
			if (p.tags.length === 0) {
				t = true
			} else {
				t = q.tags.contains(p.tags)
			}
			if (t) {
				i(y, p)
			}
		}
	};
	this.onLoad = function(o) {
		m(o, k.LOADED)
	};
	this.onError = function(o) {
		m(o, k.ERROR)
	};
	this.onTimeout = function(o) {
		m(o, k.TIMEOUT)
	};
	var i = function(p, y) {
		var t = 0, w = 0;
		for (var s = 0, o = h.length; s < o; s++) {
			var u = h[s], q = false;
			if (y.tags.length === 0) {
				q = true
			} else {
				q = u.resource.tags.contains(y.tags)
			}
			if (q) {
				w++;
				if (u.status === k.LOADED || u.status === k.ERROR || u.status === k.TIMEOUT) {
					t++
				}
			}
		}
		y.callback({
			resource : p.resource,
			loaded : (p.status === k.LOADED),
			error : (p.status === k.ERROR),
			timeout : (p.status === k.TIMEOUT),
			completedCount : t,
			totalCount : w
		})
	};
	var f = this.log = function(s) {
		if (!window.console) {
			return
		}
		var q = Math.round((+new Date - n) / 1000);
		window.console.log("PxLoader elapsed: " + q + " sec");
		for (var p = 0, o = h.length; p < o; p++) {
			var u = h[p];
			if (!s && u.status !== k.WAITING) {
				continue
			}
			var t = "PxLoader: #" + p + " " + u.resource.getName();
			switch (u.status) {
				case k.QUEUED:
					t += " (Not Started)";
					break;
				case k.WAITING:
					t += " (Waiting)";
					break;
				case k.LOADED:
					t += " (Loaded)";
					break;
				case k.ERROR:
					t += " (Error)";
					break;
				case k.TIMEOUT:
					t += " (Timeout)";
					break
			}
			if (u.resource.tags.length > 0) {
				t += " Tags: [" + u.resource.tags.join(",") + "]"
			}
			window.console.log(t)
		}
	}
}

function PxLoaderTags(a) {
	this.array = [];
	this.object = {};
	this.value = null;
	this.length = 0;
	if (a !== null && a !== undefined) {
		if (Array.isArray(a)) {
			this.array = a
		} else {
			if ( typeof a === "object") {
				for (var d in a) {
					this.array.push(d)
				}
			} else {
				this.array.push(a);
				this.value = a
			}
		}
		this.length = this.array.length;
		for (var c = 0; c < this.length; c++) {
			this.object[this.array[c]] = true
		}
	}
	this.contains = function(e) {
		if (this.length === 0 || e.length === 0) {
			return false
		} else {
			if (this.length === 1 && this.value !== null) {
				if (e.length === 1) {
					return this.value === e.value
				} else {
					return e.object.hasOwnProperty(this.value)
				}
			} else {
				if (e.length < this.length) {
					return e.contains(this)
				} else {
					for (var f in this.object) {
						if (e.object[f]) {
							return true
						}
					}
					return false
				}
			}
		}
	}
}

if (!Array.isArray) {
	Array.isArray = function(a) {
		return Object.prototype.toString.call(a) == "[object Array]"
	};
	/*!
	 jsAnim: Powerful javascript animation
	 --------------------------------------------
	 Copyright 2009 Kevin Dolan
	 -http://www.thekevindolan.com

	 Code licensed under the MIT license
	 -See license.txt

	 v0.2
	 */
}
var jsAnimManagers = new Array();
var jsAnimManagerId = 0;
/*! public, accessible
 jsAnimManager object constructor
 Used by end-user to manage jsAnim objects
 Params:
 -[timestep] : time between frames, defaults to 40
 */
function jsAnimManager(a) {
	jsAnimManagers[jsAnimManagerId] = this;
	this.myId = jsAnimManagerId;
	jsAnimManagerId++;
	if (a) {
		this.timestep = a
	} else {
		this.timestep = 40
	}
	this.paused = false;
	this.animObjects = new Array();
	this.index = 0;
	this.step = function() {
		if (!this.paused) {
			for (x in this.animObjects) {
				this.animObjects[x].step()
			}
			setTimeout("jsAnimManagers[" + this.myId + "].step()", this.timestep)
		}
	};
	this.kill = function(c) {
		delete this.animObjects[c]
	};
	/*! public
	 Called to create a new animation object
	 Params:
	 -objId : id of object being controlled
	 */
	this.createAnimObject = function(c) {
		var d = document.getElementById(c);
		var e = this.index;
		this.animObjects[e] = new jsAnimObject(d, e, this);
		this.index++;
		return this.animObjects[e]
	};
	/*! public
	 Called to pause the animation manager
	 */
	this.pause = function() {
		this.paused = true
	};
	/*! public
	 Called to unpause the animation manager
	 */
	this.resume = function() {
		this.paused = false;
		this.step()
	};
	/*! public
	 Called to set the appropriate style values to allow position to be controlled by jsAnim
	 Params:
	 -objId : id of object to be registered
	 -[fixed] : fixed positioning, false to absolute fixed, defaults to false
	 */
	this.registerPosition = function(d, h) {
		var f = document.getElementById(d);
		var e = f.offsetWidth;
		var c = f.offsetHeight;
		if (h) {
			f.style.position = "fixed"
		} else {
			f.style.position = "absolute"
		}
		f.style.top = "0px";
		f.style.left = "50%";
		f.halfWidth = Math.floor(e / 2);
		f.halfHeight = Math.floor(c / 2);
		f.style.marginLeft = (-f.halfWidth) + "px";
		f.style.marginTop = (-f.halfHeight) + "px";
		f.positionRegistered = true;
		/*! public
		 Called to manually set the position of this object
		 */
		f.setPosition = function(i, j) {
			this.style.marginLeft = (i - this.halfWidth) + "px";
			this.style.marginTop = (j - this.halfHeight) + "px"
		}
	};
	this.step();
	return true
}

/*! accesible
 jsAnimObject object constructor
 Used internally to hold the state of a single animation manager
 Params:
 -obj : object being animated

 */
function jsAnimObject(c, d, a) {
	this.id = d;
	this.obj = c;
	this.paused = false;
	this.animEntries = new Array();
	this.animLoops = new Array();
	this.current = 0;
	this.manager = a;
	this.step = function() {
		if (!this.paused) {
			for (x in this.animEntries) {
				var e = this.animEntries[x].step();
				if (e) {
					this.animLoops[x]--;
					this.animEntries[x].current = 0;
					this.animEntries[x].onLoop()
				}
				if (this.animLoops[x] == 0) {
					this.animEntries[x].onComplete();
					delete this.animEntries[x]
				}
				break
			}
		}
	};
	/*! public
	 Called to add an animation to the chain
	 Params:
	 -params : a collection in the containing the following elements
	 - property : the Prop object to animate
	 - [from] : optional from value, if unspecified current value is used
	 - to : the value to animate to
	 - duration : the length of time this animation should take
	 - [ease] : the jsAnimEase object to use, if unspecified linear will be used
	 - [loop] : the number of times to loop the animation, negative values are infinite, if unspecified 1 will be used
	 - [onLoop] : the callback function for loop completion
	 - [onComplete] : the callback function for animation completion
	 */
	this.add = function(h) {
		var n = h.property;
		var l = h.from;
		var m = h.to;
		var j = h.duration;
		if (h.ease) {
			var i = h.ease
		} else {
			var i = jsAnimEase.linear
		}
		if (h.loop) {
			var k = h.loop
		} else {
			var k = 1
		}
		if (h.onLoop) {
			var f = h.onLoop
		} else {
			var f = function() {
			}
		}
		if (h.onComplete) {
			var e = h.onComplete
		} else {
			var e = function() {
			}
		}
		this.animEntries[this.current] = new jsAnimEntry(this.obj, n, l, m, j, this.manager.timestep, i, f, e);
		this.animLoops[this.current] = k;
		this.current++
	};
	/*! public
	 Called to skip the current animation, can be used to exit an infinite loop
	 */
	this.skip = function() {
		for (x in this.animEntries) {
			delete this.animEntries[x];
			break
		}
	};
	/*! public
	 Called to pause this animator
	 */
	this.pause = function() {
		this.paused = true
	};
	/*! public
	 Called to resum this animator
	 */
	this.resume = function() {
		this.paused = false
	};
	/*! public
	 Called to kill this animator
	 */
	this.kill = function() {
		this.manager.kill(this.id)
	};
	return true
}

/*! public, accesible
 Pos object constructor
 Called to store an x and y coordinate representing an object's center
 according to the jsAnim coordinate system
 Params:
 -x : x coordinate, 0 is center, negative is left, positive is right
 -y : y coordinate, 0 is top, positive id below
 */
function Pos(a, c) {
	this.x = a;
	this.y = c;
	return true
}

/*! public, accesible
 Dim object constructor
 Called to store a width/height dimension
 Params:
 -w : width
 -h : height
 */
function Dim(a, c) {
	this.w = a;
	this.h = c;
	return true
}

/*! public, accesible
 Col object constructor
 Called to store an RGB color
 Params:
 -r : red value (0,255)
 -g : green value (0,255)
 -b : blue value (0,255)
 */
function Col(d, c, a) {
	this.r = d;
	this.g = c;
	this.b = a;
	return true
}

/*!
 jsAnimEntry object constructor
 Used internally to hold the state of single animation entry
 Params:
 -property : jsAnimProp object
 -from : initial value
 -to : end value
 -duration : total time of animation (ms)
 -ease : jsAnimEase object
 -timestep : the timestep value of the animation manager
 -onLoop : called after each loop
 -onComplete : called after completion
 */
function jsAnimEntry(h, k, i, j, f, a, e, d, c) {
	this.obj = h;
	this.property = k;
	this.from = i;
	this.to = j;
	this.duration = f;
	this.timestep = a;
	this.ease = e;
	this.current = 0;
	this.onLoop = d;
	this.onComplete = c;
	/*!
	 Used internally to move the object one step
	 Returns : true if this anim entry has completed, false otherwise
	 */
	this.step = function() {
		if (!this.from) {
			this.from = this.property.current(this.obj)
		}
		if (this.current >= this.duration) {
			var m = this.ease.transform(1);
			this.property.update(this.obj, this.from, this.to, m);
			return true
		} else {
			var l = this.current / this.duration;
			var m = this.ease.transform(l);
			this.property.update(this.obj, this.from, this.to, m);
			this.current += this.timestep;
			return false
		}
	};
	return true
}

/*! public
 jsAnimEase objects
 Used to control easing
 Methods:
 transform : Transform a number 0-1 representing a time proportion
 to a new number 0-1 representing a progress proportion
 */
var jsAnimEase = {
	/*!public
	 Constant Rate
	 */
	linear : {
		transform : function(a) {
			return a
		}
	},
	/*!public
	 Starts slow, then speeds up
	 */
	parabolicPos : {
		transform : function(a) {
			return a * a
		}
	},
	/*!public
	 Starts fast, then slows down
	 */
	parabolicNeg : {
		transform : function(a) {
			return 1 - (a - 1) * (a - 1)
		}
	},
	/*!public
	 Overshoots target then returns to target
	 Params:
	 -g : overshoot amount [0-1]
	 */
	backout : function(a) {
		return {
			transform : function(c) {
				return (-1 * c * (c + a - 2)) / (1 - a)
			}
		}
	},
	/*!public
	 Backs up a bit then moves to target
	 Params:
	 -g : backup amount [0-1]
	 */
	backin : function(a) {
		return {
			transform : function(c) {
				return 1 + ((c + 1 - a) * ((c + 1 - a) + a - 2)) / (1 - a)
			}
		}
	},
	/*!public
	 Goes to target and then back at constant rate
	 */
	bounceLinear : {
		transform : function(a) {
			if (a < 0.5) {
				return 2 * a
			} else {
				return 1 - 2 * (a - 0.5)
			}
		}
	},
	/*!public
	 Goes to target and then back at variable rate
	 */
	bounceParabolic : {
		transform : function(a) {
			return -4 * a * (a - 1)
		}
	},
	/*!public
	 Goes to target and then back smoothly
	 */
	bounceSmooth : {
		transform : function(a) {
			return 0.5 - 0.5 * Math.cos(2 * Math.PI * a)
		}
	}
}
/*!
 Utility objects for internal use
 */;
var jsAnimUtil = {
	interp : function(e, d, c) {
		if (isNaN(e)) {
			e = 0
		}
		if (isNaN(d)) {
			d = 0
		}
		var a = e + c * (d - e);
		return Math.floor(a)
	},
	getCSS : function(c, d) {
		var a = document.defaultView && document.defaultView.getComputedStyle ? document.defaultView.getComputedStyle(c, null) : c.currentStyle || c.style;
		return a[d]
	},
	explode : function(d, f, a) {
		var h = {
			0 : ""
		};
		if (arguments.length < 2 || typeof arguments[0] == "undefined" || typeof arguments[1] == "undefined") {
			return null
		}
		if (d === "" || d === false || d === null) {
			return false
		}
		if ( typeof d == "function" || typeof d == "object" || typeof f == "function" || typeof f == "object") {
			return h
		}
		if (d === true) {
			d = "1"
		}
		if (!a) {
			return f.toString().split(d.toString())
		} else {
			var i = f.toString().split(d.toString());
			var e = i.splice(0, a - 1);
			var c = i.join(d.toString());
			e.push(c);
			return e
		}
	}
}
/*! public
 Prop objects
 Used to keep track of which property is being controlled
 Methods:
 update : update the property to where it should be at the given time
 current : return a natural representation of the current property
 */;
var Prop = {
	/*! public
	 Wait, while doing no animating
	 */
	wait : {
		update : function(c, e, d, a) {
		},
		current : function(a) {
			return 0
		}
	},
	/*! public
	 Follows a linear path
	 */
	position : {
		update : function(d, h, f, c) {
			var a = jsAnimUtil.interp(h.x, f.x, c);
			var e = jsAnimUtil.interp(h.y, f.y, c);
			d.setPosition(a, e)
		},
		current : function(e) {
			var d = parseInt(e.style.marginLeft);
			var c = parseInt(e.style.marginTop);
			var a = d + e.halfWidth;
			var f = c + e.halfHeight;
			return new Pos(a, f)
		}
	},
	/*! public
	 Follows a semicircular path
	 Params:
	 -clockwise : True for clockwise, false otherwise
	 */
	positionSemicircle : function(a) {
		return {
			update : function(j, q, s, m) {
				var i = (q.x + s.x) / 2;
				var e = (q.y + s.y) / 2;
				var k = e - q.y;
				var t = q.x - i;
				var n = Math.sqrt(k * k + t * t);
				if (t == 0) {
					if (k > 0) {
						var c = -Math.PI / 2
					} else {
						var c = Math.PI / 2
					}
				} else {
					var f = Math.atan(k / Math.abs(t));
					if (t > 0) {
						var c = f
					} else {
						var c = Math.PI - f
					}
				}
				if (a) {
					var l = -m * Math.PI
				} else {
					var l = m * Math.PI
				}
				var d = c + l;
				var p = Math.floor(i + n * Math.cos(d));
				var o = Math.floor(e - n * Math.sin(d));
				j.setPosition(p, o)
			},
			current : function(f) {
				var e = parseInt(f.style.marginLeft);
				var d = parseInt(f.style.marginTop);
				var c = e + f.halfWidth;
				var h = d + f.halfHeight;
				return new Pos(c, h)
			}
		}
	},
	/*! public
	 Follows a circular path through target then back to start
	 Params:
	 -clockwise : True for clockwise, false otherwise
	 */
	positionCircle : function(a) {
		return {
			update : function(j, q, s, m) {
				var i = (q.x + s.x) / 2;
				var e = (q.y + s.y) / 2;
				var k = e - q.y;
				var t = q.x - i;
				var n = Math.sqrt(k * k + t * t);
				if (t == 0) {
					if (k > 0) {
						var c = -Math.PI / 2
					} else {
						var c = Math.PI / 2
					}
				} else {
					var f = Math.atan(k / Math.abs(t));
					if (t > 0) {
						var c = f
					} else {
						var c = Math.PI - f
					}
				}
				if (a) {
					var l = 2 * m * Math.PI
				} else {
					var l = -2 * m * Math.PI
				}
				var d = c + l;
				var p = Math.floor(i + n * Math.cos(d));
				var o = Math.floor(e + n * Math.sin(d));
				j.setPosition(p, o)
			},
			current : function(f) {
				var e = parseInt(f.style.marginLeft);
				var d = parseInt(f.style.marginTop);
				var c = e + f.halfWidth;
				var h = d + f.halfHeight;
				return new Pos(c, h)
			}
		}
	},
	top : {
		update : function(c, e, d, a) {
			c.style.top = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "top"))
		}
	},
	right : {
		update : function(c, e, d, a) {
			c.style.right = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "right"))
		}
	},
	bottom : {
		update : function(c, e, d, a) {
			c.style.bottom = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "bottom"))
		}
	},
	left : {
		update : function(c, e, d, a) {
			c.style.left = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "left"))
		}
	},
	margin : {
		update : function(c, e, d, a) {
			c.style.margin = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "margin"))
		}
	},
	marginTop : {
		update : function(c, e, d, a) {
			c.style.marginTop = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "marginTop"))
		}
	},
	marginRight : {
		update : function(c, e, d, a) {
			c.style.marginRight = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "marginRight"))
		}
	},
	marginBottom : {
		update : function(c, e, d, a) {
			c.style.marginBottom = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "marginBottom"))
		}
	},
	marginLeft : {
		update : function(c, e, d, a) {
			c.style.marginLeft = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "marginLeft"))
		}
	},
	padding : {
		update : function(c, e, d, a) {
			c.style.padding = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "padding"))
		}
	},
	paddingTop : {
		update : function(c, e, d, a) {
			c.style.paddingTop = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "paddingTop"))
		}
	},
	paddingRight : {
		update : function(c, e, d, a) {
			c.style.paddingRight = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "paddingRight"))
		}
	},
	paddingBottom : {
		update : function(c, e, d, a) {
			c.style.paddingBottom = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "paddingBottom"))
		}
	},
	paddingLeft : {
		update : function(c, e, d, a) {
			c.style.paddingLeft = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "paddingLeft"))
		}
	},
	borderWidth : {
		update : function(c, e, d, a) {
			c.style.borderWidth = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "borderWidth"))
		}
	},
	borderTopWidth : {
		update : function(c, e, d, a) {
			c.style.borderTopWidth = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "borderTopWidth"))
		}
	},
	borderRightWidth : {
		update : function(c, e, d, a) {
			c.style.borderRightWidth = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "borderRightWidth"))
		}
	},
	borderBottomWidth : {
		update : function(c, e, d, a) {
			c.style.borderBottomWidth = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "borderBottomWidth"))
		}
	},
	borderLeftWidth : {
		update : function(c, e, d, a) {
			c.style.borderLeftWidth = jsAnimUtil.interp(e, d, a) + "px"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "borderLeftWidth"))
		}
	},
	fontSize : {
		update : function(c, e, d, a) {
			c.style.fontSize = jsAnimUtil.interp(e, d, a) + "pt"
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "fontSize"))
		}
	},
	height : {
		update : function(d, h, f, c) {
			var a = jsAnimUtil.interp(h, f, c);
			d.style.height = a + "px";
			if (d.positionRegistered) {
				var e = parseInt(d.style.marginTop) + d.halfHeight;
				d.halfHeight = Math.floor(d.offsetHeight / 2);
				d.style.marginTop = e - d.halfHeight + "px"
			}
		},
		current : function(c) {
			var a = jsAnimUtil.getCSS(c, "height");
			if (a == "auto") {
				return c.offsetHeight
			} else {
				return parseInt(a)
			}
		}
	},
	width : {
		update : function(e, h, f, d) {
			var c = jsAnimUtil.interp(h, f, d);
			e.style.width = c + "px";
			if (e.positionRegistered) {
				var a = parseInt(e.style.marginLeft) + e.halfWidth;
				e.halfWidth = Math.floor(e.offsetWidth / 2);
				e.style.marginLeft = a - e.halfWidth + "px"
			}
		},
		current : function(a) {
			return parseInt(jsAnimUtil.getCSS(a, "width"))
		}
	},
	dimension : {
		update : function(f, k, j, e) {
			var d = jsAnimUtil.interp(k.h, j.h, e);
			var c = jsAnimUtil.interp(k.w, j.w, e);
			f.style.height = d + "px";
			f.style.width = c + "px";
			if (f.positionRegistered) {
				var i = parseInt(f.style.marginTop) + f.halfHeight;
				f.halfHeight = Math.floor(f.offsetHeight / 2);
				f.style.marginTop = (i - f.halfHeight) + "px";
				var a = parseInt(f.style.marginLeft) + f.halfWidth;
				f.halfWidth = Math.floor(f.offsetWidth / 2);
				f.style.marginLeft = (a - f.halfWidth) + "px"
			}
		},
		current : function(e) {
			var c = jsAnimUtil.getCSS(e, "height");
			if (c == "auto") {
				var d = e.offsetHeight
			} else {
				var d = parseInt(c)
			}
			var a = parseInt(jsAnimUtil.getCSS(e, "width"));
			return new Dim(a, d)
		}
	},
	color : {
		update : function(c, e, d, a) {
			r = jsAnimUtil.interp(e.r, d.r, a);
			g = jsAnimUtil.interp(e.g, d.g, a);
			b = jsAnimUtil.interp(e.b, d.b, a);
			c.style.color = "rgb(" + r + "," + g + "," + b + ")"
		},
		current : function(d) {
			var a = jsAnimUtil.getCSS(d, "color");
			a = a.substring(4, a.length - 1);
			var c = jsAnimUtil.explode(",", a);
			return new Col(parseInt(c[0]), parseInt(c[1]), parseInt(c[2]))
		}
	},
	backgroundColor : {
		update : function(c, e, d, a) {
			r = jsAnimUtil.interp(e.r, d.r, a);
			g = jsAnimUtil.interp(e.g, d.g, a);
			b = jsAnimUtil.interp(e.b, d.b, a);
			c.style.backgroundColor = "rgb(" + r + "," + g + "," + b + ")"
		},
		current : function(d) {
			var a = jsAnimUtil.getCSS(d, "backgroundColor");
			a = a.substring(4, a.length - 1);
			var c = jsAnimUtil.explode(",", a);
			return new Col(parseInt(c[0]), parseInt(c[1]), parseInt(c[2]))
		}
	},
	borderColor : {
		update : function(c, e, d, a) {
			r = jsAnimUtil.interp(e.r, d.r, a);
			g = jsAnimUtil.interp(e.g, d.g, a);
			b = jsAnimUtil.interp(e.b, d.b, a);
			c.style.borderColor = "rgb(" + r + "," + g + "," + b + ")"
		},
		current : function(d) {
			var a = jsAnimUtil.getCSS(d, "borderColor");
			a = a.substring(4, a.length - 1);
			var c = jsAnimUtil.explode(",", a);
			return new Col(parseInt(c[0]), parseInt(c[1]), parseInt(c[2]))
		}
	},
	opacity : {
		update : function(c, e, d, a) {
			v = jsAnimUtil.interp(100 * e, 100 * d, a);
			c.style.opacity = v / 100
		},
		current : function(a) {
			return jsAnimUtil.getCSS(a, "opacity")
		}
	}
};

function PxLoaderImage(a, k, h) {
	var j = this, i = null;
	this.img = new Image();
	this.tags = k;
	this.priority = h;
	var c = function() {
		if (j.img.readyState == "complete") {
			d();
			i.onLoad(j)
		}
	};
	var f = function() {
		d();
		i.onLoad(j)
	};
	var e = function() {
		d();
		i.onError(j)
	};
	var d = function() {
		j.unbind("load", f);
		j.unbind("readystatechange", c);
		j.unbind("error", e)
	};
	this.start = function(l) {
		i = l;
		j.bind("load", f);
		j.bind("readystatechange", c);
		j.bind("error", e);
		j.img.src = a
	};
	this.checkStatus = function() {
		if (j.img.complete) {
			d();
			i.onLoad(j)
		}
	};
	this.onTimeout = function() {
		d();
		if (j.img.complete) {
			i.onLoad(j)
		} else {
			i.onTimeout(j)
		}
	};
	this.getName = function() {
		return a
	};
	this.bind = function(l, m) {
		if (j.img.addEventListener) {
			j.img.addEventListener(l, m, false)
		} else {
			if (j.img.attachEvent) {
				j.img.attachEvent("on" + l, m)
			}
		}
	};
	this.unbind = function(l, m) {
		if (j.img.removeEventListener) {
			j.img.removeEventListener(l, m, false)
		} else {
			if (j.img.detachEvent) {
				j.img.detachEvent("on" + l, m)
			}
		}
	}
}

PxLoader.prototype.addImage = function(d, c, e) {
	var a = new PxLoaderImage(d, c, e);
	this.add(a);
	return a.img
};


// CUSTOM  CODE
function setDivText(j, i, f, a, e, l, h) {
	var k = document.getElementById("" + a);
	var c = document.getElementById("" + a + "txt");
	var d;
	if (!c) {
		d = document.createElement("div");
		d.setAttribute("id", a + "txt")
	} else {
		c.parentNode.removeChild(c);
		d = document.createElement("div");
		d.setAttribute("id", a + "txt")
	}
	d.style.color = e;
	d.style.fontSize = l;
	d.style.position = "absolute";
	d.innerHTML = "" + f;
	d.style.marginLeft = j + "px";
	d.style.marginTop = i + "px";
	k.appendChild(d)
};

/**
 * HTMLTemplate : is used as a templating utility. It helps is appending the entire string at once to the template available in HTML file.
 * the templates are described with in scrip tags.
 *Steps :
 1. add the template in html file
 <script type = "html/template" id = "image_template">
 <img class = 'img-gallery-img floatL'  src = "<%gallery_image_src%>" />
 </script>
 2.create and object of htmlTemplate & load the tepmplate
 var obj = HTMLTemplate();
 obj.loadTemplate('image_template');
 3.Render the template and display it to screen
 obj.renderTemplate('image_template',"loaction/position/imagname.png")

 *  */
HTMLTemplate = function() {

	this.temporaryCallback = null;
	this.jsonTemplates = {};
	this.bAllTemplateLoaded = false;
	return this;
}

HTMLTemplate.prototype = {
	/**
	 * Loads all the template and stores it in jsonTemplates
	 * @params {Array.<String>} arrTemplateNames  - list of template that is to loaded and stored once the application begins
	 * @params {String} sType  - type whether they are of type script or through stored set of strings
	 * @params {Method} callBackFunction - triggerd when the loading is complete
	 *  */
	loadTemplate : function(arrTemplateNames, sType, callBackFunction) {
		this.jsonTemplates = {};
		this.temporaryCallback = (callBackFunction != null) ? callBackFunction : null;

		var sContentToBeStored = "";
		if (sType == 'script') {
			for (var nIndex = 0; nIndex < arrTemplateNames.length; nIndex++) {
				var sTemp = document.getElementById(arrTemplateNames[nIndex]);

				sContentToBeStored = sTemp.innerHTML
				this.jsonTemplates[arrTemplateNames[nIndex]] = {};
				this.jsonTemplates[arrTemplateNames[nIndex]].returnContent = sContentToBeStored;
			}
		} else {
			for (var key in arrTemplateNames) {
				sContentToBeStored = arrTemplateNames[key].html;
				this.jsonTemplates[key] = {};
				this.jsonTemplates[key].returnContent = sContentToBeStored;
			}
		}

		this.bAllTemplateLoaded = true;
	},
	/**
	 *rendering the template
	 * @params {String} templateName - indicates the name of template
	 * @params {Object} data - replaces the properties from object to dynamic input expected in template
	 * @return {String} string which is formed after replacing the dynamic variables.
	 *  */
	renderTemplate : function(templateName, data) {
		if (this.bAllTemplateLoaded) {// all template is loaded
			if (this.jsonTemplates.hasOwnProperty(templateName)) {// if property exist
				var sReturn = this.jsonTemplates[templateName].returnContent
				if (data != null || data != undefined) {
					var objT = this.clone(this.jsonTemplates);
					var sTempContent = this.constructData(data, objT[templateName].returnContent);
					sReturn = (sTempContent == undefined) ? "" : sTempContent;
				}
				return sReturn;
			}
		}
	},
	clone : function(obj) {
		if (obj == null || typeof (obj) != 'object')
			return obj;
		var temp = obj.constructor();
		// changed
		for (var key in obj)
		temp[key] = this.clone(obj[key]);
		return temp;
	},

	constructData : function(data, target) {
		var returnString = undefined
		var sTemp = target;
		for (var key in data) {
			var searchingKey = key.toLowerCase();
			searchingKey = '<%' + searchingKey + '%>'
			var nIndex = sTemp.indexOf(searchingKey);
			if (nIndex != -1) {
				sTemp = String(sTemp).replace(searchingKey, data[key]);
			}

		}
		returnString = sTemp
		return returnString;
	}
};

if (!Function.prototype.bind) {
	Function.prototype.bind = function(oThis) {
		if ( typeof this !== "function") {
			// closest thing possible to the ECMAScript 5 internal IsCallable function
			throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
		}

		var aArgs = Array.prototype.slice.call(arguments, 1), fToBind = this, fNOP = function() {
		}, fBound = function() {
			return fToBind.apply(this instanceof fNOP && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
		};

		fNOP.prototype = this.prototype;
		fBound.prototype = new fNOP();

		return fBound;
	};
};





'use strict';

// Add ECMA262-5 method binding if not supported natively
//
if (!('bind' in Function.prototype)) {
    Function.prototype.bind= function(owner) {
        var that= this;
        if (arguments.length<=1) {
            return function() {
                return that.apply(owner, arguments);
            };
        } else {
            var args= Array.prototype.slice.call(arguments, 1);
            return function() {
                return that.apply(owner, arguments.length===0? args : args.concat(Array.prototype.slice.call(arguments)));
            };
        }
    };
}

// Add ECMA262-5 string trim if not supported natively
//
if (!('trim' in String.prototype)) {
    String.prototype.trim= function() {
        return this.replace(/^\s+/, '').replace(/\s+$/, '');
    };
}

// Add ECMA262-5 Array methods if not supported natively
//
if (!('indexOf' in Array.prototype)) {
    Array.prototype.indexOf= function(find, i /*opt*/) {
        if (i===undefined) i= 0;
        if (i<0) i+= this.length;
        if (i<0) i= 0;
        for (var n= this.length; i<n; i++)
            if (i in this && this[i]===find)
                return i;
        return -1;
    };
}
if (!('lastIndexOf' in Array.prototype)) {
    Array.prototype.lastIndexOf= function(find, i /*opt*/) {
        if (i===undefined) i= this.length-1;
        if (i<0) i+= this.length;
        if (i>this.length-1) i= this.length-1;
        for (i++; i-->0;) /* i++ because from-argument is sadly inclusive */
            if (i in this && this[i]===find)
                return i;
        return -1;
    };
}
if (!('forEach' in Array.prototype)) {
    Array.prototype.forEach= function(action, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this)
                action.call(that, this[i], i, this);
    };
}
if (!('map' in Array.prototype)) {
    Array.prototype.map= function(mapper, that /*opt*/) {
        var other= new Array(this.length);
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this)
                other[i]= mapper.call(that, this[i], i, this);
        return other;
    };
}
if (!('filter' in Array.prototype)) {
    Array.prototype.filter= function(filter, that /*opt*/) {
        var other= [], v;
        for (var i=0, n= this.length; i<n; i++)
            if (i in this && filter.call(that, v= this[i], i, this))
                other.push(v);
        return other;
    };
}
if (!('every' in Array.prototype)) {
    Array.prototype.every= function(tester, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this && !tester.call(that, this[i], i, this))
                return false;
        return true;
    };
}
if (!('some' in Array.prototype)) {
    Array.prototype.some= function(tester, that /*opt*/) {
        for (var i= 0, n= this.length; i<n; i++)
            if (i in this && tester.call(that, this[i], i, this))
                return true;
        return false;
    };
}