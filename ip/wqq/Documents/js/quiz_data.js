/**
 * @author sandeep
 */

var question_data = {

	questionSet1 : [{
		question : "What does this commercial vehicle have in common with a winning hand of cards? ",
		option_1 : "It delivers Parksons' playing cards throughout India",
		option_2 : "It's called The Ace",
		option_3 : "It ferries customers between tables at the Casino Royale in Goa",
		option_4 : "It's a mobile poker parlor",
		correct_answer : "1"

	}, {
		question : "By 2015 India will have 160,000,000 wireless broadband and optic fiber-based connections.That's equal to....",
		option_1 : "1 for every 8 citizens",
		option_2 : "1 for every 80 citizens",
		option_3 : "1 for every 800 citizens",
		option_4 : "1 for every 8,000 citizens",
		correct_answer : "1"

	}, {
		question : "Which states are able to compete more effectively with Internet-based communication channels for government-to-citizen services?",
		option_1 : "Assam and Goa",
		option_2 : "Kerala and Uttar Pradesh",
		option_3 : "Nagaland and Sikkim",
		option_4 : "Iowa and Indiana",
		correct_answer : "1"

	}, {
		question : "The India Postal System has been working to modernize and technologically enable its facilities.How many rural postal offices have been upgraded?",
		option_1 : "12",
		option_2 : "112",
		option_3 : "139,000",
		option_4 : "1,300",
		correct_answer : "1"
	}, {
		question : "What socio-economic benefits will India enjoy from having more digital citizens? ",
		option_1 : "More websites",
		option_2 : "More financial inclusion",
		option_3 : "Public access to information",
		option_4 : "All of the above",
		correct_answer : "1"
	}]

};

var resource_data = {
	getImageInstance : function(key) {
		return resource_data.images[key][1];
	},
	getPath : function(key) {
		return (resource_data.images[key] !== undefined ) ? resource_data.images[key][1].src : ""
	},
	images : {
		'landing_lady' : ['landing/introImg1.jpg', null],
		'grtr_logo_panel' : ['landing/grtr.jpg', null],
		'common_start_btn' : ['common/start_button.jpg', null],
		'landing_intro_btn' : ['landing/intro_button.jpg', null],
		'landing_footer' : ['landing/footer.jpg', null],
		'img_thot_bubbles' : ['intro/introScrnImg.jpg', null],
		'intro_continue_btn' : ['intro/continue_button2.jpg', null],
		'thot_bubble_end_screen' : ['end/congImg.jpg', null],
		'side_static_content' : ['game/qa.jpg', null],
		'game_continue_btn' : ['game/continue_button.jpg', null],
		'game_back_btn' : ['game/back_button.jpg', null],

	},
	dom : {//DIV NAMES
		'loading' : 'loadingScreen',
		'landing' : 'landingPage',
		'intro' : 'introductionPage',
		'game' : 'gamePage',
		'end' : 'endPage'
	},
	htmlentity : ['loading_screen_ui', 'landing_screen_ui', 'intro_screen_ui', 'game_screen_ui', 'end_screen_ui', 'top_question_game_screen_ui'],
	appMode : 1, // 0 - xtreme debugging  mode OR 1 - dev mode OR 2 -live with no console
	appTimer : 8, // its seconds
	bench_mark : [100, 300, 400], // scoring mechanism range
	no_of_stars : ["1", "2", "3"], // scoring mechanism award
	per_question : 100, // perquestion hike

}
