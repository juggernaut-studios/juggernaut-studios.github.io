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
var config = {
	level_1_End : {
		content : 'The Hummingbird symbolizes agility with a sensory <br/>supremacy to evaluate the surrounding environment,<br/>thus closely tying it to the Digital Citizen pillar of <br/>a High Performance Nation. Digital Citizens leverage<br/>technology as a "sense" to transact efficiently with <br/>the world at large.  ',
		topic : "Hummingbird"
	},
	level_2_End : {
		content : "The Eagle stands for the dramatic influence of <br />power through its fastflight supported by a strong <br />build just like the Empowered People of a High<br/>Performance Nation, who drive India's growth <br>with skills that are economically significant, richly <br>diverse and tuned to future leadership opportunities.",
		topic : "Eagle"
	},
	level_3_End : {
		content : "The Baya Weaver, a weaver bird, defies<br/>convention to create intricately woven hanging <br/>nests that protect both itself and the community <br/>from predators,exemplifying innovation that <br/>seeks to address the needs of the masses. <br/>The bird thus represents the Innovation Economy <br/>pillar of the High Performance Nation.",
		topic : "Albatross"
	},
	level_4_End : {
		content : "The Albatross, a large sea bird, covers<br/>vast distances with optimal exertion and<br/>energy by flying in large groups. Thus,<br/>this bird demonstrates the effectiveness<br/>of driving results through a Collaborative<br/>Ecosystem, the fourth pillar of a High<br/>Performance Nation.",
		topic : "Weaverbird"
	},
	questionSet1 : [{
		question : "What does this commercial vehicle have in common with a winning hand of cards? ",
		option_1 : "It delivers Parksons' playing cards throughout India",
		option_2 : "It's called The Ace",
		option_3 : "It ferries customers between tables at the Casino Royale in Goa",
		option_4 : "It's a mobile poker parlor",
		img_url : "question_images/Level_1_q_1.png",
		correct_answer : "1",
		solution : "The Ace is Tata Motors' highly successful Small Commercial Vehicle. By focusing on customer segmentation, network optimization, pipeline management and sales operations, the project team helped Tata Motors generate approximately $45 million in additional revenue and significantly boost market share in all states - all in less than nine months."
	}, {
		question : "By 2015 India will have 160,000,000 wireless broadband and optic fiber-based connections.That's equal to....",
		option_1 : "1 for every 8 citizens",
		option_2 : "1 for every 80 citizens",
		option_3 : "1 for every 800 citizens",
		option_4 : "1 for every 8,000 citizens",
		img_url : "question_images/Level_1_q_1.png",
		q_cnt : ["level_1_q_1_a", "level_1_q_1_b"],
		correct_answer : "1",
		solution : "To respond to the 50,000 calls a day, Accenture helped New York City develop 311, a 24/7 phone and online customer service center that provides nearly 4,000 services to free up resources and provide faster customer response time. 125 million calls later the city is performing better than ever."
	}, {
		question : "Which states are able to compete more effectively with Internet-based communication channels for government-to-citizen services?",
		option_1 : "Assam and Goa",
		option_2 : "Kerala and Uttar Pradesh",
		option_3 : "Nagaland and Sikkim",
		option_4 : "Iowa and Indiana",
		img_url : "question_images/Level_1_q_2.png",
		correct_answer : "3",
		q_cnt : ["level_1_q_2_a", "level_1_q_2_b"],
		solution : "With operations in over 100 countries, Unilever asked us to help simplify, standardize and unify their business model. Our teams worked to implement a single HR and talent management model, a harmonized ERP platform as well as other restructuring projects. So far, the results have helped Unilever achieve over &euro; 1 billion in savings and more than halved the time for a new IT systems rollout."
	}, {
		question : "The India Postal System has been working to modernize and technologically enable its facilities.How many rural postal offices have been upgraded?",
		option_1 : "12",
		option_2 : "112",
		option_3 : "139,000",
		option_4 : "1,300",
		img_url : "question_images/Level_1_q_3.png",
		correct_answer : "3",
		q_cnt : ["level_1_q_3_a"],
		solution : "Trinity Health has always worked to fulfill a mission to provide affordable healthcare to the community. Accenture helped them consolidate their revenue operations into a single unit. This generated more than $500 million in additional revenue over three years and allowed Trinity to continue to reinvest back into the health of the community."
	}, {
		question : "What socio-economic benefits will India enjoy from having more digital citizens? ",
		option_1 : "More websites",
		option_2 : "More financial inclusion",
		option_3 : "Public access to information",
		option_4 : "All of the above",
		img_url : "question_images/Level_1_q_4.png",
		correct_answer : "4",
		q_cnt : ["level_1_q_4_a"],
		solution : "The Ace is Tata Motors' highly successful Small Commercial Vehicle. By focusing on customer segmentation, network optimization, pipeline management and sales operations, the project team helped Tata Motors generate approximately $45 million in additional revenue and significantly boost market share in all states - all in less than nine months."
	}],
	questionSet2 : [{
		question : "What helped Piramal Healthcare turn the corner in growth?",
		option_1 : "Development of a new product line",
		option_2 : "Globalizing their portfolio",
		option_3 : "Creating a road map for sustained growth",
		option_4 : "Analyzing 20,000 hospitals",
		img_url : "question_images/Level_1_q_1.png",
		correct_answer : "1",
		solution : "Accenture deployed a team of professionals with deep industry expertise and a solid understanding of Piramal Healthcare's business to help develop Pharma Solutions' road map for sustained growth and profitability. The solutions designed by Accenture and Piramal Healthcare will enable Pharma Solutions to grow at a compounded annual growth rate of 18% over the next 3-4 years."
	}, {
		question : "In which of these countries is over 50% of the population under 25?",
		option_1 : "India",
		option_2 : "Saudi Arabia",
		option_3 : "Mexico",
		option_4 : "The Czech Republic",
		img_url : "question_images/Level_2_q_1.png",
		correct_answer : "1",
		q_cnt : ["level_2_q_1_a", "level_2_q_1_b"],
		solution : "Accenture and the senior management team at EIL worked together to discover the leadership needs of the organization vis-&agrave;-vis its strategic goals by assessing the gap between current and aspired organizational culture. The result? Over 40% of program participants moved to new and challenging roles within the organization"
	}, {
		question : "How many people does the government want to see skilled by 2022 as part of the National Skill Development Corporation program?",
		option_1 : "10 million",
		option_2 : "150 million",
		option_3 : "500 million",
		option_4 : "1 billion",
		img_url : "question_images/Level_2_q_2.png",
		correct_answer : "3",
		q_cnt : ["level_2_q_2_a", "level_2_q_2_b"],
		solution : "Accenture helped BSES Delhi reduce malpractices and strengthen its financial footing by reducing operating costs. As a result, from March '05 through to March '06, electricity losses reduced from 40.64% to 35.53% (South and West Delhi) and from 50.12% to 43.88% (Central and East Delhi). "
	}, {
		question : "India currently invests 3.8% of GDP to improve literacy and skills.What percentage should be invested to effectively meet our needs? ",
		option_1 : "20%",
		option_2 : "10%",
		option_3 : "8%",
		option_4 : "5%",
		img_url : "question_images/Level_2_q_3.png",
		correct_answer : "4",
		q_cnt : ["level_2_q_3_a"],
		solution : "With Accenture's help, Tata Motors has developed an innovative, scalable and sustainable platform for growth in rural markets. Project Neev's (foundation in Sanskrit) potential value has been confirmed by the results from the first-wave deployment areas. To date, the project has delivered more than 7,000 retail sales within the target territories. With successful scaling up of operations, Tata Motors is on track to garner an incremental business growth of roughly 15-20% from its new rural channels."
	}, {
		question : "Accenture's Skills to Succeed program has enabled India's journey to High Performance, helping businesses to grow right now because...",
		option_1 : "Only 2% of Indians aged 15-29 have formal vocational training",
		option_2 : "BPO, retail and hospitality are facing a shortfall in terms of employable talent",
		option_3 : "India's continued economic growth depends on MNC investments",
		option_4 : "All of the above",
		img_url : "question_images/Level_2_q_4.png",
		correct_answer : "4",
		q_cnt : ["level_2_q_4_a"],
		solution : "The Ace is Tata Motors' highly successful Small Commercial Vehicle. By focusing on customer segmentation, network optimization, pipeline management and sales operations, the project team helped Tata Motors generate approximately $45 million in additional revenue and significantly boost market share in all states - all in less than nine months."
	}],
	questionSet3 : [{
		question : "What's the secret to Scotch Whisky's distinct smoky flavor?",
		option_1 : "Aging in special barrels",
		option_2 : "Drying the malt over a peat-fueled fire ",
		option_3 : "Adding a few drops of Liquid Smoke to each batch",
		option_4 : "Setting a controlled burn in the field at the end of each harvest",
		img_url : "question_images/Level_3_q_1.png",
		correct_answer : "1",
		solution : "United Spirits turned to Accenture for help in firing its growth. USL's goals were to become the world's largest spirits company by volume, double its turnover, raise it's EBITDA by 50% and align its employees with this vision. It is now the world's largest spirit company by volume, is growing faster than its global competitors, has doubled its turnover and grown earnings at a compound annual growth rate of approximately 30% in the past six years."
	}, {
		question : "Every day the dabbawallahs of Mumbai pick up 200,000 lunches from homes and deliver them to work sites.What is their rate of accuracy?  ",
		option_1 : "49%",
		option_2 : "63%",
		option_3 : "81%",
		option_4 : "96%",
		img_url : "question_images/Level_3_q_1.png",
		correct_answer : "4",
		q_cnt : ["level_3_q_1_a", "level_3_q_1_b"],
		solution : "The Accenture team adopted a three-pronged approach to address the key challenges facing Larsen & Toubro-Mitsubishi Heavy Industries Boilers Private Limited (LMB). The first created a firm framework for business excellence. The second focused on operational excellence through process improvement including risk management, Kaizen, and value engineering. The third enabled LMB to execute the steps needed to take the organization closer to its vision. These initiatives have firmly placed LMB on a trajectory toward high performance while enabling it to derive sustainable, long-term business value."
	}, {
		question : "Which of these was not one of the cost-cutting measures used in production of the Tata Motors Nano?",
		option_1 : "Rear trunk only opens from the inside",
		option_2 : "No power steering",
		option_3 : "Three lug nuts on the wheels instead of four",
		option_4 : "Reducing engine size from 624cc to 500cc",
		img_url : "question_images/Level_3_q_2.png",
		correct_answer : "4",
		q_cnt : ["level_3_q_2_a", "level_3_q_2_b"],
		solution : "Birla Sun Life needed to improve its recruitment process. Accenture helped them to standardize hiring processes, create an innovative predictive analytics tool to assess business requirements, and develop a mechanism to evaluate and monitor the process. The new streamlined process delivers a 90% fulfillment rate for manager hires and a 50% improvement in retention of new manager hires. By reducing churn and lost revenue opportunities that result from attrition, they significantly improved overall productivity."
	}, {
		question : "What is the name of the new, low-cost smokeless biomass stove that can cook a meal for two for just Rs. 6?",
		option_1 : "Oorja by First Energy",
		option_2 : "Ninja by GE",
		option_3 : "Prima by Hawkins",
		option_4 : "Kelvin by Kenstar",
		img_url : "question_images/Level_3_q_3.png",
		correct_answer : "1",
		q_cnt : ["level_3_q_3_a"],
		solution : "In helping VVF transform its HR department Accenture created clear benefits in three areas:-	Recruitment process - With a newly enacted service-level-agreement (SLA) process, hiring cycle time cut in half and joiner ratio rose from 40% to 98%-	Performance management - Established &ldquo;goal cascade&rdquo; workshops and clear linkage between performance and rewards with a variable pay scale-	Talent development - total training man days doubled over a 12 month period with no commensurate increase in training budget"
	}, {
		question : "What period did the Indian Government designate as the Decade of Innovation? ",
		option_1 : "Every decade",
		option_2 : "2015-2025",
		option_3 : "2012-2022",
		option_4 : "2010-2020",
		img_url : "question_images/Level_3_q_4.png",
		correct_answer : "4",
		q_cnt : ["level_3_q_4_a"],
		solution : "The Ace is Tata Motors' highly successful Small Commercial Vehicle. By focusing on customer segmentation, network optimization, pipeline management and sales operations, the project team helped Tata Motors generate approximately $45 million in additional revenue and significantly boost market share in all states - all in less than nine months."
	}],
	questionSet4 : [{
		question : "How long old company on track for sustainable growth?",
		option_1 : "5 years",
		option_2 : "7 years",
		option_3 : "6 months",
		option_4 : "12 months",
		img_url : "question_images/Level_1_q_1.png",
		correct_answer : "1",
		q_cnt : ["level_4_q_1_a", "level_4_q_1_b"],
		solution : "Accenture helped LIC manage its transformational journey to integrate and optimize performance of distribution channels. By identifying opportunities and challenges for LIC, we were able to design and execute solutions for prioritized opportunities and manage the change journey. The growth levers spanned distribution channel architecture, sales force transformation, customer experience, marketing, product development and technology innovation."
	}, {
		question : "The Collaborative Ecosystem created by which of these stakeholders can lead to a High Performance Nation? ",
		option_1 : "Bollywood stars, gurus, dabbawallahs",
		option_2 : "Painters, writers and film makers",
		option_3 : "Gamers, students, clubbers ",
		option_4 : "Governments, businesses and communities",
		img_url : "question_images/Level_4_q_1.png",
		correct_answer : "4",
		q_cnt : ["level_4_q_1_a", "level_4_q_1_b"],
		solution : "In helping VVF transform its HR department Accenture created clear benefits in three areas:-	Recruitment process - With a newly enacted service-level-agreement (SLA) process, hiring cycle time cut in half and joiner ratio rose from 40% to 98%-	Performance management - Established &ldquo;goal cascade&rdquo; workshops and clear linkage between performance and rewards with a variable pay scale-	Talent development - total training man days doubled over a 12 month period with no commensurate increase in training budget"
	}, {
		question : "What is the benefit of alliance contracting?",
		option_1 : "Eliminates stress on job sites",
		option_2 : "Competing firms cooperate during bidding process",
		option_3 : "Links client, contractor and supply-chain  players to share risks and rewards",
		option_4 : "Encourages multinational cooperation",
		img_url : "question_images/Level_4_q_2.png",
		correct_answer : "3",
		q_cnt : ["level_4_q_2_a", "level_4_q_2_b"],
		solution : "United Spirits turned to Accenture for help in firing its growth. USL's goals were to become the world's largest spirits company by volume, double its turnover, raise it's EBITDA by 50% and align its employees with this vision. It is now the world's largest spirit company by volume, is growing faster than its global competitors, has doubled its turnover and grown earnings at a compound annual growth rate of approximately 30% in the past six years."
	}, {
		question : "India is currently executing 450 Public-Private Partnerships (PPPs) valued at US$50billion. Which of these endeavors would benefit from a PPP? ",
		option_1 : "Infrastructure creation",
		option_2 : "Urban development ",
		option_3 : "Education ",
		option_4 : "All of the above",
		img_url : "question_images/Level_4_q_3.png",
		correct_answer : "4",
		q_cnt : ["level_4_q_3_a"],
		solution : "The Accenture team adopted a three-pronged approach to address the key challenges facing Larsen & Toubro-Mitsubishi Heavy Industries Boilers Private Limited (LMB). The first created a firm framework for business excellence. The second focused on operational excellence through process improvement including risk management, Kaizen, and value engineering. The third enabled LMB to execute the steps needed to take the organization closer to its vision. These initiatives have firmly placed LMB on a trajectory toward high performance while enabling it to derive sustainable, long-term business value."
	}, {
		question : "What will the Golden Quadrilateral Project create?",
		option_1 : "More than 6,500 kilometers of national highways",
		option_2 : "A shopping square in Mumbai",
		option_3 : "A new Treasury building",
		option_4 : "A world-class soccer pitch in Bangalore",
		img_url : "question_images/Level_4_q_4.png",
		correct_answer : "1",
		q_cnt : ["level_4_q_4_a"],
		solution : "The Ace is Tata Motors' highly successful Small Commercial Vehicle. By focusing on customer segmentation, network optimization, pipeline management and sales operations, the project team helped Tata Motors generate approximately $45 million in additional revenue and significantly boost market share in all states - all in less than nine months."
	}]
};

function GamePlayScreen(a) {
	this.mApplication = a;
	this.mDivName = "questionScreen";
	this.setUp()
}

GamePlayScreen.prototype.drawFooterImplementation = function() {
	var a = new Array("0px", "0px", "250px", "502px", "628px", "743px");
	var c = "images-footer-level-" + this.mApplication.nLevelCounter;
	document.getElementById("footerImageHolder_Simple").appendChild(this.mApplication.imgArray[c]);
	document.getElementById("footerImageHolder_Color").appendChild(this.mApplication.imgArray[c + "-colored"]);
	document.getElementById("footerImageHolder_Color").style.width = a[this.mApplication.nQuestionIndex]
};
GamePlayScreen.prototype.drawFooterImages = function(a, c) {
	var e = "";
	var f;
	for (var d = 0; d < a.length; d++) {
		f = "footer_images/" + a[d] + "" + c;
		document.getElementById("footerImageHolder_Stc").appendChild(this.mApplication.imgArray[f])
	}
	return e
};
GamePlayScreen.prototype.setUp = function() {
	var c = this;
	this.mApplication.showScreen(this.mDivName);
	var a = "";
	var d = "";
	var h = "spacingMore";
	if (this.mApplication.nLevelCounter == 2 && this.mApplication.nQuestionIndex == 4) {
		d = "spacingKam";
		h = ""
	}
	var e = config["questionSet" + this.mApplication.nLevelCounter];
	a += '<div class="levelTxt"><span>Level ' + this.mApplication.nLevelCounter + "</span> | Q. No: " + this.mApplication.nQuestionIndex + "/" + this.mApplication
	.arrLevelTotalQuestion[this.mApplication.nLevelCounter] + "</div>";
	a += '<div class="qCont">';
	a += '<div class="questDiv">';
	a += '<div class="quesTxt endCongrats_level' + this.mApplication.nLevelCounter + " " + h + '">';
	a += e[this.mApplication.nQuestionIndex].question;
	a += "</div>";
	a += '<div class="ansBox">';
	a += '<ol type="A" style=" margin-left: -8px! Important; ">';
	a += '<li style=" font-size: 16px; font-weight: bold; margin-left: 0; ">';
	a += '<div id ="option_1" class="ansTxt ' + d + '">' + e[this.mApplication.nQuestionIndex].option_1 + "</div>";
	a += "</li>";
	a += '<li style=" font-size: 16px; font-weight: bold; margin-left: 0; ">';
	a += '<div id ="option_2"  class="ansTxt ' + d + '">' + e[this.mApplication.nQuestionIndex].option_2 + "</div>";
	a += "</li>";
	a += '<li style=" font-size: 16px; font-weight: bold; margin-left: 0; ">';
	a += '<div id ="option_3"  class="ansTxt ' + d + '">' + e[this.mApplication.nQuestionIndex].option_3 + "</div>";
	a += "</li>";
	a += '<li style=" font-size: 16px; font-weight: bold; margin-left: 0; ">';
	a += '<div id ="option_4"  class="ansTxt ' + d + '">' + e[this.mApplication.nQuestionIndex].option_4 + "</div>";
	a += "</li>";
	a += "</ol>";
	a += "</div>";
	a += "</div>";
	a += '<div class="qeusImg">';
	var f = getAssetPath("img", e[this.mApplication.nQuestionIndex].img_url);
	a += '<img src="' + f + '"  />';
	a += "</div>";
	a += "</div>";
	a += '<div id="footerImageHolder_Stc" class="footer_stc">';
	a += '<div id="footerImageHolder_Simple" >';
	a += "</div>";
	a += '<div id="footerImageHolder_Color"  class="footer_stc_color">';
	a += "</div>";
	a += "</div>";
	document.getElementById(this.mDivName).innerHTML = a;
	this.drawFooterImplementation();
	a = "";
	this.sidePanel();
	document.getElementById("option_1").onclick = function() {
		c.mApplication.answerSelected(1)
	};
	document.getElementById("option_2").onclick = function() {
		c.mApplication.answerSelected(2)
	};
	document.getElementById("option_3").onclick = function() {
		c.mApplication.answerSelected(3)
	};
	document.getElementById("option_4").onclick = function() {
		c.mApplication.answerSelected(4)
	}
};
GamePlayScreen.prototype.sidePanel = function() {
	var a = "";
	var k;
	this.mApplication.showSelectedScreen("sidePanel");
	var j = new Array(0, 0, 25, 50, 75, 100);
	a += '<div id="sidePanelImages_Stc" class="perc">You have completed<br>';
	a += "<span> " + j[this.mApplication.nQuestionIndex] + "%</span><br><br>";
	a += "</div>";
	document.getElementById("sidePanel").innerHTML = a;
	for (var d = 1; d < 5; d++) {
		if (d < this.mApplication.nLevelCounter) {
			k = "level_" + d + "_image5"
		} else {
			if (d == this.mApplication.nLevelCounter) {
				k = "level_" + d + "_image" + this.mApplication.nQuestionIndex
			} else {
				k = "level_" + d + "_image1"
			}
		}
		document.getElementById("sidePanelImages_Stc").appendChild(this.mApplication.imgArray[k]);
		var e = document.createElement("br");
		var c = document.createElement("br");
		document.getElementById("sidePanelImages_Stc").appendChild(e);
		document.getElementById("sidePanelImages_Stc").appendChild(c)
	}
	document.getElementById("sidePanel").className = "rgtMenu";
	var h = document.createElement("div");
	h.setAttribute("id", "backButtonOnGamePlay");
	h.innerHTML = "Start Over";
	document.getElementById("sidePanel").appendChild(h);
	h.className = "backButton gameplaybackButton marginshift";
	var f = this;
	document.getElementById("backButtonOnGamePlay").onclick = function() {
		f.mApplication.setGameState(50);
		f.mApplication.nextTransition()
	}
};

function closeQuestionOverlay() {
	document.getElementById("overlayScreen_ForQuestion").style.display = "none";
	document.getElementById("opaqueScreen_ForQuestion").style.display = "none";
	document.getElementById("opaqueScreen_bg_forQuestion").style.block = "none"
}

GamePlayScreen.prototype.showQuestionOverlay = function() {
	if (document.getElementById("opaqueScreen_ForQuestion").innerHTML == "-1") {
		var a = "TRY AGAIN SAME QUESTION";
		document.getElementById("opaqueScreen_ForQuestion").innerHTML = a
	}
	document.getElementById("overlayScreen_ForQuestion").style.display = "block";
	document.getElementById("opaqueScreen_ForQuestion").style.display = "block";
	document.getElementById("opaqueScreen_ForQuestion").style.zIndex = 9;
	document.getElementById("opaqueScreen_bg_forQuestion").style.display = "block";
	document.getElementById("opaqueScreen_bg_forQuestion").style.zIndex = 7;
	var c = _gMainApplication.imgArray["PTA_level" + _gMainApplication.nLevelCounter];
	document.getElementById("opaqueScreen_ForQuestion").innerHTML = "";
	document.getElementById("opaqueScreen_ForQuestion").appendChild(c);
	document.getElementById("overlayScreen_ForQuestion").onclick = function() {
		closeQuestionOverlay()
	};
	document.getElementById("clickQuestionTryAgain").onclick = function() {
		closeQuestionOverlay()
	}
};

function HowToPlayScreen(a) {
	this.mApplication = a;
	this.mDivName = "howtoplayScreen";
	this.setUp()
}

HowToPlayScreen.prototype.setUp = function() {
	var c = this;
	this.mApplication.showScreen(this.mDivName);
	if (document.getElementById(this.mDivName).innerHTML == "") {
		var a = "";
		a += '<h2 style="margin-left: 23px; margin-top: 29px;font-size: 32px !Important;font-weight: bold !Important;margin-bottom: 12px;">How to play</h2>';
		a += '<ol class="hwpList">';
		a += "<li>The game is based on origami*. There are four origami birds for you to create. Each bird represents a pillar of what we believe are the imperatives for India to continue on the path of being a High Performance Nation.</li>";
		a += "<li>At each level, you will need to answer  four simple questions to create the respective bird. </li>";
		a += "<li>With every correct answer, you are one step closer to creating the origami bird for that pillar.</li>";
		a += "<li>Once you answer the four questions correctly, the respective origami bird is formed and you then proceed to creating the bird in the next level.</li>";
		a += "<li>Complete all four levels to create four beautiful birds which will then form a part of the peacock, thus creating a unified vision of our High Performance Nation. </li>";
		a += "</ol>";
		a += '<p class="howToPlayPara" style=" margin-left: 24px!Important; margin-top: 19px!Important; ">';
		a += "Besides playing the game you can also learn the traditional art of origami and make special shapes <br> for your family and friends.";
		a += "</p>";
		a += '<p class="howToPlayPara " style=" margin-left: 24px!Important; ">';
		a += "Let's get started!";
		a += "</p> ";
		a += '<p class="howToPlayPara" style="  margin-left: 24px!Important; font-size: 14px;  ">';
		a += "*Japanese art of folding a flat sheet of paper and transforming it into a finished shape.";
		a += "</p> ";
		a += "<p>";
		a += '<div id= "how_to_play_back_btn" class="backButton">Back</div>';
		a += '<div id= "how_to_play_play_now" class="howPlayBtn">Play now</div>';
		a += "</p>";
		document.getElementById(this.mDivName).innerHTML = a
	}
	document.getElementById("how_to_play_back_btn").onclick = function() {
		c.mApplication.setGameState(50);
		c.mApplication.nextTransition()
	};
	document.getElementById("how_to_play_play_now").onclick = function() {
		c.mApplication.setGameState(52);
		c.mApplication.nextTransition()
	}
};

function LevelEndScreen(a) {
	this.mApplication = a;
	this.mDivName = "levelEndScreen";
	this.setUp()
}

LevelEndScreen.prototype.sidePanel = function() {
	var a = "";
	var h;
	this.mApplication.showSelectedScreen("sidePanel");
	var f = new Array(0, 0, 25, 50, 75, 100);
	a += '<div  id ="sidePanelImages_Stc" class="perc">You have completed<br>';
	a += "<span> 100%</span><br><br>";
	a += "</div>";
	document.getElementById("sidePanel").innerHTML = a;
	for (var d = 1; d < 5; d++) {
		if (d < this.mApplication.nLevelCounter) {
			h = "level_" + d + "_image5"
		} else {
			if (d == this.mApplication.nLevelCounter) {
				h = "level_" + d + "_image5"
			} else {
				h = "level_" + d + "_image1"
			}
		}
		document.getElementById("sidePanelImages_Stc").appendChild(this.mApplication.imgArray[h]);
		var e = document.createElement("br");
		var c = document.createElement("br");
		document.getElementById("sidePanelImages_Stc").appendChild(e);
		document.getElementById("sidePanelImages_Stc").appendChild(c)
	}
	document.getElementById("sidePanel").className = "rgtMenu"
};
LevelEndScreen.prototype.setUp = function() {
	var d = this;
	this.mApplication.showScreen(this.mDivName);
	this.mApplication.showSelectedScreen("sidePanel");
	var a = "";
	var c = "Next Level";
	if (this.mApplication.nLevelCounter == 4) {
		c = "Next"
	}
	a += "<div >";
	a += '<div id="end_level_img_holder" style="width:730px; height:349px;margin-top: 50px;margin-left: 20px;"></div><br/>';
	a += '<div  id="start_next_level" class="nextButton">' + c + "</div>";
	a += '<div class="nxtLink endMain_level' + this.mApplication.nLevelCounter + '">	';
	a += "<br/><br/><br/>";
	a += '<a href="javascript:showOverlay();" id ="linkToHB" class="hnpCustomLink endMain_level' + this.mApplication.nLevelCounter + '" ><span class="endMain_level' + this.mApplication.nLevelCounter + '"  style=" margin-left: -19px !Important; "><u>Master the ' + config["level_" + this.mApplication.nLevelCounter + "_End"].topic + " origami here! </u></span></a>";
	a += "</div></div>";
	document.getElementById(this.mDivName).innerHTML = a;
	var e = "images-level-" + this.mApplication.nLevelCounter + "-end-screen";
	document.getElementById("end_level_img_holder").appendChild(this.mApplication.imgArray[e]);
	document.getElementById("start_next_level").onclick = function() {
		if (c == "Next Level") {
			d.mApplication.setGameState(120);
			d.mApplication.nextTransition()
		} else {
			d.mApplication.setGameState(130);
			d.mApplication.nextTransition()
		}
	};
	this.sidePanel();
	document.getElementById("linkToHB").onclick = function() {
	}
};

function closeOverlay() {
	document.getElementById("overlayScreen").style.display = "none";
	document.getElementById("opaqueScreen").style.display = "none";
	document.getElementById("download_link").style.display = "none"
}

function showOverlay() {
	var d = new Array("", "Humming.png", "Eagle.png", "Albatross.png", "Weaver.png");
	var a = getAssetPath("img", "images/birds/" + d[_gMainApplication.nLevelCounter]);
	var c = '<img src="' + a + '" height="100%" width="80%"/>';
	document.getElementById("opaqueScreen").innerHTML = c;
	document.getElementById("opaqueScreen_bg").style.display = "block";
	document.getElementById("overlayScreen").style.display = "block";
	document.getElementById("opaqueScreen").style.display = "block";
	document.getElementById("download_link").style.display = "block";
	document.getElementById("clickOverlayClose").innerHTML = "<u>Close X </u>";
	document.getElementById("download_link").innerHTML = "<u>Download the Image</u>";
	document.getElementById("download_link").onclick = function() {
		var e = new Array("", "Humming.png", "Eagle.png", "Albatross.png", "Weaver.png");
		var f = String(document.location.href);
		f = f.split("/Pages/")[0];
		f += "/PublishingImages/origami/images/birds/" + e[_gMainApplication.nLevelCounter];
		window.open(f, "_blank")
	};
	document.getElementById("opaqueScreen_bg").onclick = function() {
		closeOverlay()
	};
	document.getElementById("opaqueScreen").onclick = function() {
		closeOverlay()
	};
	document.getElementById("clickOverlayClose").onclick = function() {
		closeOverlay()
	}
}

function LoadingScreen(a) {
	this.mApplication = a;
	this.mDivName = "loadingScreen";
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.setUp()
}

LoadingScreen.prototype.setUp = function() {
	this.mApplication.showScreen(this.mDivName);
	document.getElementById("loadingScreen").innerHTML = '<div id="loadingScreen_front" style="width: 240px;height: 240px;"></div><div id="loadingMessage"></div>';
	this.mGameSplashLoader = new PxLoader();
	this.mGameAssetLoader = new PxLoader();
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/blue.png"));
	this.mApplication.imgArray = {};
	this.mApplication.imgArray.images_congratsEnd = this.mGameAssetLoader.addImage(getAssetPath("img", "images/congratsEnd.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f1.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f2.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f3.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f4.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f5.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/f6.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/green.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/Q1_image.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/red.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "images/yellow.png"));
	
	
	
	this.mApplication.imgArray["images-intro-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/introduction-screen-element.png"));
	this.mApplication.imgArray["images-level-1-end-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/Humming-Bird_level-complete.png"));
	this.mApplication.imgArray["images-level-2-end-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/Eagle_level-complete.png"));
	this.mApplication.imgArray["images-level-4-end-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/Weaver-Bird_level-complete.png"));
	this.mApplication.imgArray["images-level-3-end-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/Albatross_level-complete.png"));
	this.mApplication.imgArray["images-winner-end-screen"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/congratulation-screen.png"));
	this.mApplication.imgArray["images-footer-level-1"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level1_footer.png"));
	this.mApplication.imgArray["images-footer-level-1-colored"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level1_footer_colored.png"));
	this.mApplication.imgArray["images-footer-level-2"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level2_footer.png"));
	this.mApplication.imgArray["images-footer-level-2-colored"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level2_footer_colored.png"));
	this.mApplication.imgArray["images-footer-level-3"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level3_footer.png"));
	this.mApplication.imgArray["images-footer-level-3-colored"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level3_footer_colored.png"));
	this.mApplication.imgArray["images-footer-level-4"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level4_footer.png"));
	this.mApplication.imgArray["images-footer-level-4-colored"] = this.mGameAssetLoader.addImage(getAssetPath("img", "footer_images/level4_footer_colored.png"));
	
	this.mApplication.imgArray["only_birds"] = this.mGameAssetLoader.addImage(getAssetPath("img", "images/only_birds.png"));
	
	var a = 0;
	for ( a = 0; a < 25; a++) {
		var e = a + 2;
		if (e < 10) {
			e = "0" + e
		}
		var c = a + 1;
		this.mApplication.imgArray["anim_image" + c] = this.mGameAssetLoader.addImage(getAssetPath("img", "levelend_images/100" + e + ".png"))
	}
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_1_q_1.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_1_q_2.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_1_q_3.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_1_q_4.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_2_q_1.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_2_q_2.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_2_q_3.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_2_q_4.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_3_q_1.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_3_q_2.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_3_q_3.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_3_q_4.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_4_q_1.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_4_q_2.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_4_q_3.png"));
	this.mGameAssetLoader.addImage(getAssetPath("img", "question_images/Level_4_q_4.png"));
	this.mApplication.imgArray.level_1_image1 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_1_image1.png"));
	this.mApplication.imgArray.level_1_image2 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_1_image2.png"));
	this.mApplication.imgArray.level_1_image3 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_1_image3.png"));
	this.mApplication.imgArray.level_1_image4 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_1_image4.png"));
	this.mApplication.imgArray.level_1_image5 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_1_image5.png"));
	this.mApplication.imgArray.level_2_image1 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_2_image1.png"));
	this.mApplication.imgArray.level_2_image2 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_2_image2.png"));
	this.mApplication.imgArray.level_2_image3 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_2_image3.png"));
	this.mApplication.imgArray.level_2_image4 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_2_image4.png"));
	this.mApplication.imgArray.level_2_image5 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_2_image5.png"));
	this.mApplication.imgArray.level_3_image1 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_3_image1.png"));
	this.mApplication.imgArray.level_3_image2 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_3_image2.png"));
	this.mApplication.imgArray.level_3_image3 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_3_image3.png"));
	this.mApplication.imgArray.level_3_image4 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_3_image4.png"));
	this.mApplication.imgArray.level_3_image5 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_3_image5.png"));
	this.mApplication.imgArray.level_4_image1 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image1.png"));
	this.mApplication.imgArray.level_4_image2 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image2.png"));
	this.mApplication.imgArray.level_4_image3 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image3.png"));
	this.mApplication.imgArray.level_4_image4 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image4.png"));
	this.mApplication.imgArray.level_4_image5 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image5.png"));
	this.mApplication.imgArray.level_4_image1 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image1.png"));
	this.mApplication.imgArray.level_4_image2 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image2.png"));
	this.mApplication.imgArray.level_4_image3 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image3.png"));
	this.mApplication.imgArray.level_4_image4 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image4.png"));
	this.mApplication.imgArray.level_4_image5 = this.mGameAssetLoader.addImage(getAssetPath("img", "sidepanel_images/level_4_image5.png"));
	this.mApplication.imgArray.PTA_level1 = this.mGameAssetLoader.addImage(getAssetPath("img", "img/images/PTA_level1.png"));
	this.mApplication.imgArray.PTA_level2 = this.mGameAssetLoader.addImage(getAssetPath("img", "img/images/PTA_level2.png"));
	this.mApplication.imgArray.PTA_level3 = this.mGameAssetLoader.addImage(getAssetPath("img", "img/images/PTA_level3.png"));
	this.mApplication.imgArray.PTA_level4 = this.mGameAssetLoader.addImage(getAssetPath("img", "img/images/PTA_level4.png"));
	this.mApplication.imgArray.loader_1 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader1.png"));
	this.mApplication.imgArray.loader_2 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader2.png"));
	this.mApplication.imgArray.loader_3 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader3.png"));
	this.mApplication.imgArray.loader_4 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader4.png"));
	this.mApplication.imgArray.loader_5 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader5.png"));
	this.mApplication.imgArray.loader_6 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader6.png"));
	this.mApplication.imgArray.loader_7 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader7.png"));
	this.mApplication.imgArray.loader_8 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader8.png"));
	this.mApplication.imgArray.loader_9 = this.mGameSplashLoader.addImage(getAssetPath("img", "splash/Loader9.png"));
	this.mApplication.imgArray.humming_bird_image = this.mGameAssetLoader.addImage(getAssetPath("img", "images/close-image.jpg"));
	var d = this;
	this.mGameAssetLoader.addProgressListener(function(f) {
		d.gameAssetLoadingProgress(f)
	});
	this.mGameAssetLoader.addCompletionListener(function() {
		d.gameAssetLoaded()
	});
	this.mGameSplashLoader.addProgressListener(function(f) {
		d.splashAssetLoadingProgress(f)
	});
	this.mGameSplashLoader.addCompletionListener(function() {
		d.splashAssetLoaded()
	});
	this.mGameSplashLoader.start()
};
LoadingScreen.prototype.splashAssetLoaded = function() {
	document.getElementById("appContainer").style.display = "block";
	document.getElementById("loading_script_tags").style.display = "none";
	document.getElementById("loadingScreen_front").appendChild(this.mApplication.imgArray.loader_1);
	document.getElementById("loadingMessage").innerHTML = "Loading 0%";
	this.mGameAssetLoader.start()
};
LoadingScreen.prototype.splashAssetLoadingProgress = function(a) {
};
LoadingScreen.prototype.gameAssetLoaded = function() {
	this.mApplication.nextTransition()
};
LoadingScreen.prototype.gameAssetLoadingProgress = function(c) {
	var a = (parseInt(c.completedCount / c.totalCount * 100) >> 0);
	document.getElementById("loadingMessage").innerHTML = "Loading " + a + " %";
	if (a % 10 == 0) {
		if (a / 10 != 10) {
			var d = a / 10;
			while (document.getElementById("loadingScreen_front").hasChildNodes()) {
				document.getElementById("loadingScreen_front").removeChild(document.getElementById("loadingScreen_front").lastChild)
			}
			document.getElementById("loadingScreen_front").appendChild(this.mApplication.imgArray["loader_" + d])
		}
	}
};

function SplashScreen(a) {
	this.mApplication = a;
	this.mDivName = "splashScreen";
	this.setUp()
}

SplashScreen.prototype.setUp = function() {
	var c = this;
	this.mApplication.showScreen(this.mDivName);
	if (document.getElementById(this.mDivName).innerHTML == "") {
		var a = "";
		/*a = '<div class="introScreen" >';
		a += '<div id ="intro_img_holder">';
		a += "</div>";
		a += '<div class="introScreen" style="margin-left: 15px;">';
		a += '<div  id= "intro_play_now" class="playButton">Play now</div>';
		a += "</div>";
		a += "</div>";
		document.getElementById(this.mDivName).innerHTML = a;
		var d = "images-intro-screen";
		document.getElementById("intro_img_holder").appendChild(this.mApplication.imgArray[d])
		 
		* */
		
		/*
		 * SHUB 
		 
		a ='<div class="introScreen">';
				a += '<div>';
				a += '	<h1 style="margin-left:30px; margin-top:30px;">Introduction</h1>';
					a += '<p class="intropara">';
						a += 'India is on an important journey to become a High<br />';
						a += 'Performance Nation and Accenture is proud to be a part<br />';
						a += 'of it. Our vision for this journey is built on four strong<br />';
						a += 'pillars:';
					a += '</p>';
				
				
		var d_url = "only_birds";
			a += '<div class="introImgs" > <img src="'+this.mApplication.imgArray[d_url].src+'" />';
			a += '</div>';
			a += '</div>';
			a += '<div class="introScreen">';
				a += '<ul>';
					a += '<li>Digital Citizen</li>';
					a += '<li>Empowered People</li>';
					a += '<li>Innovation Economy</li>';
					a += '<li>Collaborative Ecosystem</li>';
				a += '</ul>';
				a += '<p class="introparaLeft" style="margin-top:19px;line-height: 27px;">';
					a += 'Each pillar conveys a distinct, strategic imperative and the <br />';
					a += 'four pillars contribute to the evolution of a High<br />';
					a += 'Performance Nation- represented by four birds riding on the<br />';
					a += 'back of the Peacock, the national bird of India.';
				a += '</p>';
                a += '<p class="introparaLeft" style="line-height: 27px;">';
					a += 'Join the adventure by answering questions that will help<br />';
					a += 'create the four origami birds, which descends on the<br />';
					a += 'Peacock- creating a unified vision of our High Performance Nation.';
				a += '</p>';
                a += '<div  id= "intro_play_now" class="playButton">Play now</div>';
			a += '</div>';
		*/
		
		a = '	<h1 style="margin-left:30px;margin-top: 20px; ">Introduction</h1>';
		a +='<div class="introScreenLeft">';
				a += '<div>';
					a += '<p class="intropara" style="   margin-top: 30px!important;   margin-left: 30px;   line-height: 25px;   margin-top: 30px!important;   margin-left: 30px;   line-height: 25px;   font-size: 15px!important;">';
						a += 'India is on an important journey to become a High<br />';
						a += 'Performance Nation and Accenture is proud to be a part<br />';
						a += 'of it. Our vision for this journey is built on four strong<br />';
						a += 'pillars:';
					a += '</p>';
				
				
		var d_url = "only_birds";
			a += '<div class="introImgs" > <img src="'+this.mApplication.imgArray[d_url].src+'" />';
			a += '</div>';
			a += '</div>';
			a += '</div>';
			a += '<div class="introScreen">';
				a += '<ul>';
					a += '<li>Digital Citizen</li>';
					a += '<li>Empowered People</li>';
					a += '<li>Innovation Economy</li>';
					a += '<li>Collaborative Ecosystem</li>';
				a += '</ul>';
				a += '<p class="introparaLeft" style="margin-top: 19px!important;line-height: 27px;">';
					a += 'Each pillar conveys a distinct, strategic imperative and the <br />';
					a += 'four pillars contribute to the evolution of a High<br />';
					a += 'Performance Nation&ndash;represented by four birds riding on the<br />';
					a += 'back of the Peacock, the national bird of India.';
				a += '</p>';
                a += '<p class="introparaLeft" style="line-height: 27px;">';
					a += 'Join the adventure by answering questions that will help<br />';
					a += 'create the four origami birds, which descends on the<br />';
					a += 'Peacock&ndash;creatinga unified vision of our High Performance Nation.';
				a += '</p>';
                a += '<div  id= "intro_play_now" class="playButton">Play now</div>';
			
		
		document.getElementById(this.mDivName).innerHTML = a;
		document.getElementById(this.mDivName).style.fontSize = "15px";
		
		
		
		
		
	}
	document.getElementById("intro_play_now").onclick = function() {
		c.mApplication.playBirdAnimation = true;
		c.mApplication.setGameState(50);
		c.mApplication.nextTransition()
	}
};

function GameOpeningPage(a) {
	this.mApplication = a;
	this.mDivName = "new_intro_Anim";
	this.nStartTime = 1000;
	this.nPadding = 800;
	this.arrAnim = new Array();
	this.arrAnimObject = new Array();
	this.animCounter = 1;
	this.bird_anim_complete = 1;
	this.setUp()
}

GameOpeningPage.prototype.animatePeacock = function() {
	var a = this;
	a.arrAnim[a.animCounter] = document.getElementById("main_P");
	document.getElementById("main_P").style.display = "block";
	a.mApplication.jsAnimManager.registerPosition("main_P");
	a.arrAnim[a.animCounter].setPosition(1000, 350);
	a.arrAnimObject[a.animCounter] = a.mApplication.jsAnimManager.createAnimObject("main_P");
	a.arrAnimObject[a.animCounter].add({
		property : Prop.position,
		to : new Pos(300, 350),
		duration : 2000,
		onComplete : function() {
			$("#anim_content_text").fadeTo("slow", 1);
			$("#how_to_play_back_btn_1").fadeTo("slow", 1);
			$("#how_to_play_play_now_1").fadeTo("slow", 1)
		}
	})
};
GameOpeningPage.prototype.setUp = function() {
	var c = this;
	this.mApplication.showScreen(this.mDivName);
	document.getElementById(this.mDivName).innerHTML == "";
	var a = "";
	a += '<div id= "birds_animation" ></div>';
	a += '<div id= "main_P" class="bird_peacock_anim"> ';
	a += '<div id= "anim_content_text" class="anim_content"><span style="color: #A0B3D3;"></span><span  style="  color: orange; font-weight: bold;" >&nbsp;</span></div>';
	a += '<div id= "how_to_play_back_btn_1" class="anim_how_to_play">How to Play</div>';
	a += '<div id= "how_to_play_play_now_1" class="anim_play_now">Play the game</div>';
	a += "</div>";
	document.getElementById(this.mDivName).innerHTML = a;
	document.getElementById("main_P").appendChild(this.mApplication.imgArray.images_congratsEnd);
	if (c.mApplication.playBirdAnimation) {
		this.timerObject = setInterval(function() {
			if (c.animCounter < 25) {
				while (document.getElementById("birds_animation").firstChild) {
					document.getElementById("birds_animation").removeChild(document.getElementById("birds_animation").firstChild)
				}
				document.getElementById("birds_animation").appendChild(c.mApplication.imgArray["anim_image" + c.animCounter]);
				c.animCounter++
			} else {
				while (document.getElementById("birds_animation").firstChild) {
					document.getElementById("birds_animation").removeChild(document.getElementById("birds_animation").firstChild)
				}
				clearInterval(c.timerObject);
				c.animatePeacock()
			}
		}, 100);
		c.mApplication.playBirdAnimation = false
	} else {
		c.animatePeacock()
	}
	document.getElementById("how_to_play_back_btn_1").onclick = function() {
		c.mApplication.setGameState(30);
		c.mApplication.nextTransition()
	};
	document.getElementById("how_to_play_play_now_1").onclick = function() {
		c.mApplication.setGameState(52);
		c.mApplication.nextTransition()
	}
};

function WinnerScreen(a) {
	this.mApplication = a;
	this.mDivName = "winnerScreen";
	this.setUp()
}

WinnerScreen.prototype.setUp = function() {
	var c = this;
	this.mApplication.showScreen(this.mDivName);
	var a = "";
	a += "<div >";
	a += '<div id="winner_screen_img_holder" style="width:839px; height:470px;margin-top: 50px;margin-left: 25px;"></div><br/>';
	a += '<div id= "learn_more" class="clickButton clickHereMore_Hack playagain_button_ongame_end">Play again</div>';
	a += '<div id= "learn_more_dup" class="clickButton clickHereMore_Hack">Click here to learn more</div>';
	a += "</div>";
	document.getElementById(this.mDivName).innerHTML = a;
	var d = "images-winner-end-screen";
	document.getElementById("winner_screen_img_holder").appendChild(this.mApplication.imgArray[d]);
	document.getElementById("learn_more").onclick = function() {
		c.mApplication.setGameState(140);
		c.mApplication.nextTransition()
	}
	document.getElementById("learn_more_dup").onclick = function() {
		var f = "http://www.accenture.com/in-en/Pages/helping-india-towards-high-performance.aspx";
		window.open(f, "_blank")
	}
	
};
ApplicationWrapper.prototype.nextTransition = function() {
	switch (this.nGameState) {
		case 0:
		case 10:
			this.nGameState = 20;
			this.mCurrentScreen = new LoadingScreen(this);
			break;
		case 20:
			this.nGameState = 30;
			this.mCurrentScreen = new SplashScreen(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 30:
			this.nGameState = 40;
			this.mCurrentScreen = new HowToPlayScreen(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 50:
			this.nGameState = 51;
			this.resetVariables();
			this.mCurrentScreen = new GameOpeningPage(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 52:
			this.nGameState = 60;
			this.startTheGamePlay();
			break;
		case 70:
			this.nGameState = 80;
			this.mCurrentScreen = new GamePlayScreen(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 90:
			break;
		case 100:
			this.startTheGamePlay();
			break;
		case 110:
			this.mCurrentScreen = new LevelEndScreen(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 120:
			this.nLevelCounter++;
			this.nQuestionIndex = 0;
			this.startTheGamePlay();
			break;
		case 130:
			this.mCurrentScreen = new WinnerScreen(this);
			document.getElementById(this.mCurrentScreen.mDivName).style.opacity = 0;
			$("#" + this.mCurrentScreen.mDivName).fadeTo("slow", 1);
			break;
		case 140:
			this.nQuestionIndex = 0;
			this.nLevelCounter = 1;
			this.nGameState = 60;
			this.startTheGamePlay();
			break
	}
};
ApplicationWrapper.prototype.startTheGamePlay = function() {
	if (this.nQuestionIndex < this.arrLevelTotalQuestion[this.nLevelCounter]) {
		this.nQuestionIndex++;
		this.nGameState = 70;
		this.nextTransition()
	} else {
		if (this.nLevelCounter <= this.arrLevelTotalQuestion.length - 1) {
			this.nGameState = 110;
			this.nextTransition()
		} else {
			this.nGameState = 110;
			this.nextTransition()
		}
	}
};
ApplicationWrapper.prototype.setGameState = function(a) {
	this.nGameState = a
};
ApplicationWrapper.prototype.startGameTimer = function(a) {
	this.arrQuestion = new Array();
	var c = this;
	this.nQuizTimeCntr = 120;
	this.nQuizScore = 0;
	this.nQuestionIndex = Math.floor(Math.random() * config.questionSet.length - 1);
	if (Number(this.nQuestionIndex) > 12) {
		this.nQuestionIndex = 0
	}
	if (Number(this.nQuestionIndex) < 0) {
		this.nQuestionIndex = 0
	}
	this.nQuizTimer = setInterval(function() {
		c.nQuizTimeCntr--;
		if (c.nQuizTimeCntr <= 0) {
			clearInterval(c.nQuizTimer);
			c.nGameState = 130;
			c.nextTransition()
		}
		document.getElementById("timer_txt").innerHTML = "" + c.nQuizTimeCntr;
		document.getElementById("score_txt").innerHTML = "" + c.nQuizScore
	}, 1000)
};
ApplicationWrapper.prototype.answerSelected = function(c) {
	var a = config["questionSet" + this.nLevelCounter];
	if (c == a[this.nQuestionIndex].correct_answer) {
		this.nQuizScore = this.nQuizScore + this.nCorrectAnswer;
		this.nGameState = 100;
		this.nextTransition()
	} else {
		this.nGameState = 70;
		this.mCurrentScreen.showQuestionOverlay()
	}
};
ApplicationWrapper.prototype.resetVariables = function() {
	this.nQuestionIndex = 0;
	this.nLevelCounter = 1
};
ApplicationWrapper.prototype.showSelectedScreen = function(a) {
	document.getElementById(a).style.display = "block"
};
ApplicationWrapper.prototype.showScreen = function(c) {
	var a = 0;
	for ( a = 0; a < this.mScreenManager.length; a++) {
		if (c != this.mScreenManager[a]) {
			document.getElementById(this.mScreenManager[a]).style.display = "none"
		} else {
			document.getElementById(this.mScreenManager[a]).style.display = "block"
		}
	}
};
ApplicationWrapper.prototype.setUp = function(a) {
	this.mScreenManager = a.screenNames
};
var DOMWrapper = null;

function ApplicationWrapper() {
	this.nGameState = 0;
	this.mScreenManager = new Array();
	this.mCurrentScreen = null;
	this.nLevelCounter = 1;
	this.arrLevelTotalQuestion = new Array(0, 4, 4, 4, 4);
	this.arrLevel_Grey = new Array("level_1_q_1_a", "level_1_q_1_b", "level_1_q_2_a", "level_1_q_2_b", "level_1_q_3_a", "level_1_q_4_a");
	this.nQuestionIndex = 0;
	this.nLevelCounter = 1;
	this.nQuizTimer = 0;
	this.nQuizTimeCntr = 120;
	this.nQuizScore = 0;
	this.nCorrectAnswer = 100;
	this.nWrongAnswer = 0;
	this.nBenchmarkScore = 100;
	this.bcarouselCreated = false;
	this.arrQuestion = null;
	DOMWrapper = this;
	this.imgArray = {};
	this.playBirdAnimation = false;
	this.jsAnimManager = new jsAnimManager(10);
	return this
}

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