/**
 * @author DEVELOPER@JnS
 *
 *
 Select the particular layers you want to save as a .png file
 press Ctrl+e (that'll merge them into a single layer)
 select all and copy
 press Ctrl+n to create new file.
 The default option in Photoshop is that the size of the new file will be the same as what you've in clip-board. In this case, it'll give you a size with the empty spaces trimmed.
 Now paste your clip-board content and save as .png.

 */

/**
 *Logging the javascript errors
 *  */

function ApplicationWrapper() {
	this.nGameState = 10;
	this.appMode = 0;
	this.mScreenManager = new Array();
	this.appMetaData = {
		levelcounter : 0,
		questioncounter : 0,
		totalquestion : 5,
		totallevel : 1,
		apptimer : 120,
		questionSet : 1,
		benchmark : [100, 200, 300]
	};

	this.appSessionData = {
		questioncounter : 0,
		questionSet : 1
	}

	this.answeredQuestion = [];
	this.answeredAnswers = [];
	this.mTrackerAnswers = [];
	this.mScoreTracker = [];
	this.mTotalScore = 0;

	this.mAppTimerComponent = 0;
	this.mAppDisplayTimer = 0;
	this.mHTMLTemplate = null;

	 if(resource_data !== undefined)
         resource_data.usemobileimages(isDesktopFlag);	
	//this.jsAnimManager = new jsAnimManager(10);
	this.setValues();
	this.nextScene();
	return this
}

ApplicationWrapper.prototype = {
	resetSession : function() {
		this.appSessionData = {
			questioncounter : 0,
			apptimer : 0,
			questionSet : 1
		}

		this.answeredQuestion = [];
		this.answeredAnswers = [];
		this.mTrackerAnswers = [];
		this.mScoreTracker = [];

		this.appMetaData.totalquestion = question_data['questionSet' + this.appMetaData.questionSet].length - 1;

		this.appMetaData.apptimer = resource_data.appTimer;

		for (var indx = 0; indx <= this.appMetaData.totalquestion; indx++)
			this.mTrackerAnswers.push(indx);

		this.mTotalScore
		//TIMER RESET
		this.stopAppTimer();

		this.mAppTimerComponent = 0;
		this.mAppDisplayTimer = 0;

	},
	onProgressTimer : function() {
		this.mAppDisplayTimer--;
		//this.mCurrentScreen.onWrapperPush('timer',{val:this.mAppDisplayTimer});
		if (this.mAppDisplayTimer <= 0) {
			this.stopAppTimer();
			this.mCurrentScreen.onWrapperPush('end_timer', {
				val : this.mAppDisplayTimer
			});
		} else {
			this.mAppTimerComponent = setTimeout(this.onProgressTimer.bind(this), (1000));
			this.mCurrentScreen.onWrapperPush('timer', {
				val : this.mAppDisplayTimer
			});
		}

	},
	startAppTimer : function() {
		clearInterval(this.mAppTimerComponent);
		this.mAppDisplayTimer = this.appMetaData.apptimer;

		this.mCurrentScreen.onWrapperPush('timer', {
			val : this.mAppDisplayTimer
		});
		
		this.mAppTimerComponent = setTimeout(this.onProgressTimer.bind(this), (1000));

	},

	stopAppTimer : function() {
		clearInterval(this.mAppTimerComponent);
	},
	setValues : function() {
		
	
		this.appMode = resource_data.appMode;
		this.mHTMLTemplate = new HTMLTemplate();
		this.mHTMLTemplate.loadTemplate(resource_data.htmlentity, 'script');

		this.appMetaData.totalquestion = question_data['questionSet' + this.appMetaData.questionSet].length - 1;
		this.appMetaData.benchmark = resource_data.bench_mark;

		for (var indx = 0; indx <= this.appMetaData.totalquestion; indx++)
			this.mTrackerAnswers.push(indx);
	},
	setUp : function(d) {
		this.mScreenManager = d.screenNames;
		this.showScreen();
	},
	checkCounter : function() {
		var bReturn = false
		if (this.appSessionData.questioncounter < 0) {
			this.appSessionData.questioncounter = 0;
			if (this.answeredQuestion.length - 1 === this.appMetaData.totalquestion) {
				bReturn = -1
			} else {
				//#>LOOP BETWEEN QUESTIONS
				//#>this.appSessionData.questioncounter = this.appMetaData.totalquestion;
				//#>bReturn = 0

				bReturn = -1
			}

		} else if (this.appSessionData.questioncounter > this.appMetaData.totalquestion) {
			this.appSessionData.questioncounter = this.appMetaData.totalquestion;
			if (this.answeredQuestion.length - 1 === this.appMetaData.totalquestion) {
				bReturn = 1
			} else {
				this.appSessionData.questioncounter = 0;
				bReturn = 0
			}
		} else {
			bReturn = 0;
		}

		trace(" SETTING : " + this.appSessionData.questioncounter);
		return bReturn;

	},
	getCurrentQuestionCntr :function()
	{
		return this.appSessionData.questioncounter;
	},
	isAnswered : function(mV) {

		var kilo, m = this.answeredQuestion.indexOf((mV === undefined) ? this.appSessionData.questioncounter : mV);
		if (m !== -1)
			kilo = this.answeredAnswers[m]
		return [m, kilo, mV, (this.mScoreTracker[m] == 0) ? false : true];
	},
	scoringMechanism : function(m) {
		var bReturn = false, mIndex, usrAns = this.answeredAnswers[m];

		var actual = question_data['questionSet' + this.appMetaData.questionSet][this.appSessionData.questioncounter].correct_answer
		if (usrAns === actual) {
			this.mScoreTracker[m] = resource_data.per_question;
			bReturn = true
		} else {
			this.mScoreTracker[m] = 0;
			bReturn = false
		}

		this.mTotalScore = 0
		for ( mIndex = 0; mIndex < this.mScoreTracker.length; mIndex++)
			this.mTotalScore += this.mScoreTracker[mIndex];

		trace("TOTAL SCORE " + this.mTotalScore)
		return bReturn;
	},
	setAnsweredQuestion : function(answer) {
		var bReturn = false, m = this.answeredQuestion.indexOf(this.appSessionData.questioncounter);
		if (m === -1) {
			m = this.answeredAnswers.length;
			this.answeredQuestion.push(this.appSessionData.questioncounter);
			this.answeredAnswers.push(answer);

		} else {
			this.answeredQuestion[m] = this.appSessionData.questioncounter;
			this.answeredAnswers[m] = answer;
		}
		bReturn = this.scoringMechanism(m);

		trace("Q:" + this.answeredQuestion)
		trace("A:" + this.answeredAnswers)
		trace("S:" + this.mScoreTracker)

		return bReturn;
	},
	getFinalScreenMsg : function(msg) {
		var bReturn = ["", "", ""];

		if (this.mTotalScore <= resource_data.bench_mark[0]) {
			bReturn[0] = "OK";
			bReturn[2] = resource_data.no_of_stars[0];
		} else if (this.mTotalScore > resource_data.bench_mark[0] && this.mTotalScore <= resource_data.bench_mark[1]) {
			bReturn[0] = "Good";
			bReturn[2] = resource_data.no_of_stars[1];
		} else {
			bReturn[0] = "Excellent";
			bReturn[2] = resource_data.no_of_stars[2];
		}

		bReturn[1] = "" + Number(this.appMetaData.apptimer) - Number(this.mAppDisplayTimer);

		return bReturn;
	},
	moveTo : function(str) {
		var mTraker = ['start', 'intro', 'home', 'end'];
		var mState = [60, 40, 20, 80];

		if (mTraker.indexOf(str) !== -1)
			this.nGameState = mState[mTraker.indexOf(str)];
		else
			trace(" INVALID GAME STATE " + str);

		this.nextScene();

	},
	/*
	 10 -  Loading
	 20 - Landing
	 40 - Intro
	 60 - Actual Main Screen
	 80 - End Screen
	 * */
	nextScene : function() {
		trace(" showing : " + this.nGameState)
		switch(this.nGameState) {
			case 10:
				this.nGameState = 20;
				this.mCurrentScreen = new LoadingScreen(this);
				break;
			case 20:
				this.nGameState = 40;
				this.resetSession();
				this.stopAppTimer();
				this.mCurrentScreen = new LandingScreen(this);
				break;
			case 40:
				this.nGameState = 60;
				this.mCurrentScreen = new IntroScreen(this);
				break;
			case 60:
				this.nGameState = 80;
				if (this.answeredQuestion.length == 0)
					this.appSessionData.questioncounter = 0

				this.mCurrentScreen = new GameScreen(this);
				this.startAppTimer();
				break;
			case 80:
				this.nGameState = 20;
				this.stopAppTimer();
				this.mCurrentScreen = new EndScreen(this);
				break;

		}
	},
	showScreen : function(c) {
		var a = 0;
		if (c !== undefined) {
			for ( a = 0; a < this.mScreenManager.length; a++) {
				if (c != this.mScreenManager[a]) {
					document.getElementById(this.mScreenManager[a]).style.display = "none"
				} else {
					document.getElementById(this.mScreenManager[a]).style.display = "block"
				}
			}
		} else {
			for ( a = 0; a < this.mScreenManager.length; a++) {
				document.getElementById(this.mScreenManager[a]).style.display = "none"
			}
		}

	},
	renderTemplate : function(id, data) {
		var mH = this.mHTMLTemplate.renderTemplate(id, data)
		if (mH == undefined)
			trace(" INVALID ID FOR TEMPLATING : " + id);

		return (mH !== undefined) ? mH : "";
	},
	addEventHandler : function(ID, evtType, handler) {
		var domEle = document.getElementById(ID);
		if (domEle !== undefined && domEle.attachEvent) {
			domEle.attachEvent("on" + evtType, handler);
		} else if (domEle !== undefined) {
			domEle.addEventListener(evtType, handler);
		}

	},
	manipulateQuestionCounter : function(val) {

		this.appSessionData.questioncounter += val
	}
}

window.onerror = function(msg, url, lineNumber) {
	msg = "msg:" + msg + " URL:" + url + " LineNumber:" + lineNumber;
	if (_gMainApplication !== undefined && _gMainApplication.appMode == 0)
		alert(msg);
	else
		trace(msg);
}
var trace = function(str) {
	if (_gMainApplication !== undefined && _gMainApplication.appMode == 1)
		console.log("#[QUIZ APP LOGS]:" + str);
}
function doOnOrientationChange() {
	switch(window.orientation) {
		case -90:
		case 90:
			alert('App could be best viewed in portrait mode!');
			break;
		default:
			alert('portrait');
			break;
	}
}


window.addEventListener ? window.addEventListener('orientationchange', doOnOrientationChange) : window.attachEvent && window.attachEvent("onorientationchange", doOnOrientationChange);

window.onresize = function(event) {
	/*if (_gMainApplication !== undefined) {
		var w, h;
		if (window.innerWidth) {
			w = window.innerWidth;
			h = window.innerHeight;
		} else {
			w = document.body.clientWidth;
			h = document.body.clientHeight;
		}
		_gMainApplication.mCurrentScreen.onWrapperPush('screen_update', {
			w : w,
			h : h
		});
	}*/
}
/*
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

 */

