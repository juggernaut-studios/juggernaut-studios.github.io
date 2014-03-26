/**
 * @author deviator206@gmail.com
 */

var config = {

	notes : [{
		header : 'Semantic Web',
		content : ['<i> and <b> were HTML4 font style elements and are still used  as presentationally where appropriate to follow typographical cconventions', 'But now it has semantic  meaning, however their style can be changed via CSS']
	}, {
		header : 'Semantic Web',
		content : ['<b> doesn\'t have to be bold, Because it is recommened to use classes to indicate meaning to make it easy to change the style later.', '<b> element represents a span of text to which attention is being drawn for useful/practical purposes without conveying any extra importance and with no implication of an alternate voice or mood. Text that is bold by typographic convention (and not because it’s more important)']
	}, {
		header : 'Semantic Web',
		content : ['example :', '<b>It was 1:00am</b> when he returned from city.', 'it is bol because of typography convention. If this was semantically important then perfect usage would be <strong>']
	}, {
		header : 'Semantic Web',
		content : ['<i> element : represents a span of text in an alternate voice or mood, or otherwise offset from the normal prose in a manner indicating a different quality of text']
	}, {
		header : 'Semantic Web',
		content : ['example :', 'DECKARD: Move! Get out of the way!', '<i>Deckard fires. Kills Zhora in dramatic slow motion scene.</i>', 'DECKARD: The report would be routine retirement of a replicant which didn’t make me feel any better about shooting a woman in the back. There it was again. ', 'Feeling, in myself. For her, for Rachael.', 'DECKARD: Deckard. B-263-54.', 'Using <i class="voiceover"> to indicate a voiceover (alternate mood)']
	}, {
		header : 'Semantic Web ',
		content : ['While <em> and <strong> have remained pretty much the same, there has been a slight realignment in their meanings. In HTML4 they meant ‘emphasis’ and ‘strong emphasis’. Now their meanings have been differentiated into <em> representing stress emphasis (i.e., something you’d pronounce differently), and <strong> representing importance.']
	}, {
		header : 'Semantic Web ',
		content : ['<em> :The em element represents stress emphasis of its contents.', 'example :', '“Call a <em>doctor</em> now!” emphasises the importance of calling a doctor, perhaps in reply to someone asking “Should I get a nurse?” In contrast, “Call a doctor <em>now</em>!” emphasises the importance of calling immediately']
	}, {
		header : 'Semantic Web ',
		content : ['<strong> :strong element represents strong importance for its contents.']
	}, {
		header : 'Semantic Web ',
		content : ['conclusion:', 'Use <strong> instead to indicate importance and <i> when you want italics without implying emphasis']
	}, {
		header : 'Semantic Web',
		content : ['"Bold" is a style - when you say "bold a word", people basically know that it means to add more, let\'s say "ink" around the letters until they stand out more', 'amongst the rest of the letters.', 'But same is not the case for blind']
	}, {
		header : 'Semantic Web',
		content : ['<b> is a style - we know what "bold" is supposed to look like.', '<strong> however is an indication of how something should be understood. "Strong" could (and often does) mean "bold" in a browser, but it could also mean a lower tone for a speaking program like Jaws (for blind people). And strong on a Palm Pilot may be an underline (since you can\'t bold a bold).']
	}, {
		header : 'QUESTIONS',
		content : ['????']
	}, {
		header : 'CANVAS',
		content : ['Its a Drawing surface.', 'By definition : canvas - a resolution-dependent bitmap which can be used to render graphs and graphics or visual images on fly.', 'Resolution dependent is another term for bitmap images, where images are created  by small pixels.', 'The bigger the pixels, the bad the image comes out but the smaller it is, the better. ', 'Resolution independent are another name for vector images,where it can be re-sized through any extent, it does not ruin the image like bitmap images']
	}, {
		header : 'CANVAS',
		content : ['IE 8 & 7 - thrid party plugin -explore-canvas']
	}, {
		header : 'CANVAS',
		content : ['Canvas-  How does it look like ??', 'It is empty. Element has no border no content of its own', '<canvas></canvas> // this would render the invisible canvas with width 300x150 (by default)']
	}, {
		header : 'CANVAS',
		content : ['Fallback content:<canvas>Ur Browser does not support canvas</canvas>']
	}, {
		header : 'CANVAS',
		content : ['Properties of Canvas', 'fillStyle : can be CSS color or gradient .Default value is black.', 'fillRect: args(x,y,width,height) , draws rectangle with current fillStyle value', 'strokeStyle - is like fillStye for gradient and color', 'strokeRect - args (x,y,width,height) draws rectangle without filling the middle part. Its just edges.', 'clearRect  - args(x,y,width,height) - clears the pixels in rectangle']
	}, {
		header : 'CANVAS',
		content : ['canvas co-ordinates : Its 2D grid. Extreme upper left corner is(0,0)']
	}, // NEW ADD HERE

	{
		header : 'CANVAS:simple drawing',
		content : ['drawing on canvas is similar to drawing with pencil, One need to use pencil tip touch it on paper move it ahead and then lift it.', 'canvas uses the same thing', 'moveTo(x,y) // moves the pencil to specified starting point', 'lineTo(x,y) // draws a line to the specified ending point', 'but we have drawn it. But for it wont do anything', 'we require ink for the same', 'ctx.stroke() //is one of the “ink” methods. It takes the complex path you defined with all those moveTo() and lineTo() calls, and actually draws it on the canvas.', 'The strokeStyle controls the color of the lines. ']
	}, {
		header : 'CANVAS:Drawing Paths',
		content : ['beginPath() //Creates a new path. Once created, future drawing commands are directed into the path and used to build the path up.', 'closePath()//Closes the path so that future drawing commands are once again directed to the context.', 'context.arc(x,y,radius,starting_angle,ending_angle,counter-clock-wise)', 'starting_angle // in radians', 'ending_angle //', 'var radians = degrees * Math.PI / 180;', 'counter-clock-wise / /default is false']
	}, {
		header : 'CANVAS:Arcs',
		content : ['ctx.beginPath();', 'ctx.arc(200, 200, 100, 0, Math.PI+Math.PI/4,false);', 'ctx.fillStyle ="rgb(0,121,222)" ;', 'ctx.stroke();', 'ctx.fill();']
	}, {
		header : 'CANVAS: Triangle',
		content : ['moveTo(startX,starY)', 'lineTo(nextX,nextY)', 'lineTo(next_nextX,next_next_Y)']
	}, {
		header : 'CANVAS :CURVES',
		content : ['quadratic  and bezier curve', 'bezier curve : mathematically defined curve used in 2D graphic application.', 'The curve is defined in 4 points.the initia position   + terminating position  is called anchors', '2 middle points are called handles', 'FUN FACT : It was formed in 1960\'s for the manufacturing of automobiles at Renault by Pierre Bézier']
	}, {
		header : 'CANVAS : QUADRATIC CURVE',
		content : ['quadraticCurveTo(cp1x, cp1y, x, y) : ', 'quadratic Bézier curve from the current pen position to the end point specified by x and y, using the control point specified by cp1x and cp1y.']
	}, {
		header : 'CANVAS : QUADRATIC CURVE',
		content : ['bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) ', 'Draws a cubic Bézier curve from the current pen position to the end point specified by x and y, using the control points specified by (cp1x, cp1y) and (cp2x, cp2y).', 'The x and y parameters in both of these methods are the coordinates of the end point. ', 'cp1x and cp1y are the coordinates of the first control point, and ', 'cp2x and cp2y are the coordinates of the second control point.']
	}, {
		header : 'CANVAS: TEXT',
		content : ['Unlike Text in normal HTML, the text in canvas has no box-model around it.', 'This implies there is no floats, no margins, no paddings', 'prop :', 'font', 'textAlign  : start, end, left, right, and center', 'textBaseline  :middle, alphabetic, ideographic, or bottom']
	}, {
		header : 'CANVAS TEXT',
		content : ['ctx.font ="bold 12px sans-serif";', 'ctx.fillText(" SAMPLE TEXT IN CANVAS ",100,100);']
	}, {
		header : 'CANVAS IMAGE',
		content : ['Image can be added as follows', 'var imgE = new Image()', 'ctx.drawImage(imgEle,x,y);', 'ctx.drawImage(imgEle,x,y,width,height);']

	}, {
		header : 'Slicing Image',
		content : ['drawImage(sourceX,sourceY,source_Width,source_Height,dest_X,dest_Y,dest_Width,dest_Height);']
	}]
}
