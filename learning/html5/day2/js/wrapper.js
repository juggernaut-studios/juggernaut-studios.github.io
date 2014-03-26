/**
 * @author deviator206@gmail.com
 */

var jns = jns || {};

jns.Notes = function() {
	this.currentSlideNumber = 0;
	this.setUp();
	return this;
}

jns.Notes.prototype = {
	setUp : function() {
		document.getElementById("prevBtn").addEventListener("click", this.showSlide.bind(this, -1));
		document.getElementById("nxtBtn").addEventListener("click", this.showSlide.bind(this, 1))

		this.showSlide(0);
	},
	modify : function(strcontent) {
		var st = strcontent;
		st = st.replace(/</g, "&lt;")
		st = st.replace(/>/g, "&gt;")
		return st;
	},
	modifyGetContent : function(arr) {
		var st = "";
		for (var i = 0; i < arr.length; i++) {
			st += "<br>" + this.modify(arr[i])+"";
		}
		return st;

	},
	showSlide : function(id, evt) {
		this.currentSlideNumber += id;
		if (this.currentSlideNumber <= 0) {
			this.currentSlideNumber = 0;
			if (id !== 0)
				alert("REACHED 1st SLIDE");

		} else if (this.currentSlideNumber > config.notes.length - 1) {
			this.currentSlideNumber = config.notes.length - 1;
			alert("REACHED last SLIDE");
		}
		document.getElementById('headertext').innerHTML = this.modify(config.notes[this.currentSlideNumber].header);
		document.getElementById('contenttext').innerHTML = this.modifyGetContent(config.notes[this.currentSlideNumber].content);
	}
}
window.addEventListener("load", function() {
	window.notes = new jns.Notes();

});
