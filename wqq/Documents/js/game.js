/**
 * @author deviator206
 */

function GameScreen(a) {
	this.mApplication = a;
	this.mDivName = resource_data.dom['game'];
	this.mGameSplashLoader = null;
	this.mGameAssetLoader = null;
	this.mCurrentSelectionAnswerID = -1;
	this.mCurrentQuesitonData = {};
	this.crossImageURL = ""
	this.setUp()
}

GameScreen.prototype = {
	setUp : function() {
		this.mApplication.showScreen(this.mDivName);

		var resourceKey, sHTML = this.mApplication.renderTemplate('game_screen_ui', {

		});
		document.getElementById(this.mDivName).innerHTML = sHTML;

		if (document.getElementById('game_back_btn') != undefined) {
			document.getElementById('game_back_btn').style.backgroundImage = "url('" + resource_data.getPath("game_back_btn") + "')";
			this.mApplication.addEventHandler('game_back_btn', 'click', this.clickHandler.bind(this));
		}

		document.getElementById('side_panel_for').style.backgroundImage = "url('" + resource_data.getPath("pb0") + "')";
		document.getElementById('explanationContent').style.display = "none"
		//document.getElementById('game_continue_btn').style.backgroundImage = "url('" + resource_data.getPath("intro_continue_btn") + "')";
		
		//
		
		
		//addEventListener
		this.mApplication.addEventHandler('game_continue_btn', 'click', this.clickHandler.bind(this));
		this.mApplication.addEventHandler('game_submit_btn', 'click', this.clickHandler.bind(this));
		this.crossImageURL = resource_data.getPath("cross_img");

		this.displayQuestionsTopPanel();
		this.displayQuestion()
		this.addEventListener()

	},
	displayQuestionsTopPanel : function() {
		//deviat_pgNukmbers
		$(".quiz-number-inner-container").empty();
		var indx = 1, total = this.mApplication.appMetaData['totalquestion'], sHTML = "";

		for ( indx = 0; indx <= total; indx++) {
			var isFirst = ((indx === 0 || indx === 11) ? "first-quiz-number" : "");
			sHTML += this.mApplication.renderTemplate('top_question_game_screen_ui', {
				value : indx + 1,
				questionnumber : indx,
				is_first_element : isFirst
			});
		}

		$(".quiz-number-inner-container").html(sHTML);
	},
	addEventListener : function() {
		var index;
		for ( index = 1; index < 5; index++)
			this.mApplication.addEventHandler('option' + index, 'click', this.clickHandler.bind(this));
	},
	displayQuestion : function(bCheck) {
		var mCheck = this.mApplication.checkCounter();

		switch(mCheck) {

			case 0:
				var questionTotal = this.mApplication.appMetaData['totalquestion'], mTemp, index = 1, m = this.mApplication.appSessionData['questioncounter'], set = this.mApplication.appSessionData['questionSet'];
				this.mCurrentQuesitonData = this.mApplication.question_data["questionSet"+set][m];

				document.getElementById('questionContent').innerHTML = this.mCurrentQuesitonData.question;
				//FOR OPTIONS
				for ( index = 1; index < 5; index++) {
					$("div #option" + index).css("color", '#FFF')
					if (this.mCurrentQuesitonData['option_' + index] !== "") {
						document.getElementById('option' + index + "_container").style.display = "block";
						document.getElementById('option' + index).innerHTML = this.mCurrentQuesitonData['option_' + index];
					} else {
						document.getElementById('option' + index + "_container").style.display = "none";
					}
				}

				/*//FOR TOP QUESTION LIST
				for ( index = 0; index <= questionTotal; index++) {
				mTemp = this.mApplication.isAnswered(index);

				if (mTemp[0] !== -1) {
				$("#q_" + index).css("border", '#2E529C solid 2px');
				if (mTemp[3] !== undefined) {
				var color = (mTemp[3] == true) ? 'green' : 'red'
				$("#q_" + index).css("background-color", color);
				}
				} else {
				$("#q_" + index).css("border", '#FDDF05 2px solid ');
				}
				}

				mTemp = this.mApplication.isAnswered();
				if (mTemp[0] !== -1) {
				$("div #option" + mTemp[1]).css("color", '#FDDF05');
				//$("#q_" + m).css("border", '#2E529C solid 2px');
				} else {

				//$("#q_" + m).css("border", '2px solid rgb(156, 100, 0)');
				}
				*/
				//same color for all current version
				$("#q_" + m).css("border", '2px solid white');
				$(".option-container").css("display", "block");
				$("#game_submit_btn").css("display", "block");
				//alert(this.mCurrentSelectionAnswerID)
				var nCntr = m+1;
				document.getElementById('inner_progress').style.backgroundImage = "url('" + resource_data.getPath("pb"+nCntr) + "')";
				break;
			case -1:
				trace(" HAS CROSSED 1ST ELEMENT NOW BACK TO LANDING PAGE");
				this.mApplication.moveTo('home');

				break;
			case 1:
				trace(" HAS CROSSED LAST ELEMENT NOW  TO FInAL PAGE");
				this.mApplication.moveTo('end');
				break;

		}

	},

	clickHandler : function(event) {
		var target = (event.currentTarget) ? event.currentTarget : event.srcElement;
		trace("GAME Page: CLICKED :" + target.id);
		switch(target.id) {
			case 'game_submit_btn':
				var answer, s = (document.getElementById('game_continue_btn').innerHTML).toLowerCase();
				if (this.mCurrentSelectionAnswerID !== -1) {
					answer = this.mApplication.setAnsweredQuestion(this.mCurrentSelectionAnswerID);
					var color = (answer == true) ? 'green' : 'red';
					var rightoption = this.mCurrentQuesitonData["option_"+this.mCurrentQuesitonData.correct_answer]

					//$("#q_" + this.mApplication.appSessionData['questioncounter']).css("background-color", color);
					if(!answer )
					$("#q_" + this.mApplication.appSessionData['questioncounter']).css("background", "url('"+this.crossImageURL+"') center center no-repeat");

					this.mCurrentSelectionAnswerID = -1
					//hide the options and submit button
					$(".option-container").css("display", "none");
					$("#game_submit_btn").css("display", "none");

					$("#explanationContent .answer-title").html(((answer == true) ? 'Correct' : 'Incorrect'));
					var expText = (answer != true) ? 'The correct answer is '+rightoption+'. ' : ''
					$("#explanationContent .answer-text").html(expText +''+this.mCurrentQuesitonData['explanation']);

					document.getElementById('explanationContent').style.display = "block"
					
					this.mApplication.pauseAppTimer();

				}

				break;
			case 'game_continue_btn':
				var answer, s = (document.getElementById('game_continue_btn').innerHTML).toLowerCase();
				// continue after reading the explanation
				document.getElementById('explanationContent').style.display = "none"
				//document.getElementById('game_continue_btn').innerHTML = "Submit"
				this.mApplication.manipulateQuestionCounter(1)
				this.displayQuestion(true);
				this.mApplication.restartAppTimer();
				break;
			case 'game_back_btn':
				this.mApplication.manipulateQuestionCounter(-1)
				this.displayQuestion();
				break;
			case 'old':
				var m = String(target.id).substr(6, String(target.id).length);
				this.mApplication.setAnsweredQuestion(m);
				$("#q_" + this.mApplication.appSessionData['questioncounter']).css("border", '#2E529C solid 2px');
				this.mApplication.manipulateQuestionCounter(1)
				this.displayQuestion();
				break;
			default :
				this.mCurrentSelectionAnswerID = String(target.id).substr(6, String(target.id).length);
				//$("#q_" + this.mApplication.appSessionData['questioncounter']).css("border", '#2E529C solid 2px');

				$("#option1").css("color", 'white');
				$("#option2").css("color", 'white');
				$("#option3").css("color", 'white');
				$("#option4").css("color", 'white');
				$("#option" + this.mCurrentSelectionAnswerID).css("color", 'yellow');

				break;

		}
		return false;
	},

	convertTimeIntoDisplayFormat : function(val) {

		var minutes = Math.floor(Number(val) / 60);
		var seconds = val - minutes * 60;
		;

		if (minutes < 10) {
			minutes = "0" + minutes
		}
		if (seconds < 10) {
			seconds = "0" + seconds
		}
		return minutes + " : " + seconds;

	},
	onWrapperPush : function(cmd, data) {
		switch(cmd) {
			case 'timer':
				//trace(" current time: " + data.val)
				document.getElementById("timerComponent").innerHTML = this.convertTimeIntoDisplayFormat(data.val);
				break;
			case 'end_timer':
				trace("timer is over : now forced to End screen");
				this.mApplication.moveTo('end')
				break;
		}
	}
}

