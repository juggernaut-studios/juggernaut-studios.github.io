/**
 pslWheel : JQuery Plugin for carousel implementation.

 The MIT License

 Copyright (c) 2013 JnS(http://juggernaut-studios.com/opensource).

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

( function($) {
		$.fn.pslWheel = function(options) {

			var mCarousel = this;
			var mOptions = {};
			var mData = {};
			var mDefaultValues = {
				startingItem : 1, // item to place in the center of the carousel. Set to 0 for auto
				separation : 175, // distance between items in carousel
				separationMultiplier : 0.6, // multipled by separation distance to increase/decrease distance for each additional item
				horizonOffset : 0, // offset each item from the "horizon" by this amount (causes arching)
				horizonOffsetMultiplier : 1, // multipled by horizon offset to increase/decrease offset for each additional item
				sizeMultiplier : 0.7, // determines how drastically the size of each item changes
				opacityMultiplier : 0.8, // determines how drastically the opacity of each item changes
				horizon : 0, // how "far in" the horizontal/vertical horizon should be set from the container wall. 0 for auto
				flankingItems : 3, // the number of items visible on either side of the center

				// animation
				speed : 300, // speed in milliseconds it will take to rotate from one to the next
				animationEasing : 'linear', // the easing effect to use when animating
				quickerForFurther : true, // set to true to make animations faster when clicking an item that is far away from the center
				edgeFadeEnabled : false, // when true, items fade off into nothingness when reaching the edge. false to have them move behind the center image
				leftAnimate : true,

				// misc
				linkHandling : 2, // 1 to disable all (used for facebox), 2 to disable all but center (to link images out)
				autoPlay : 0, // indicate the speed in milliseconds to wait before autorotating. 0 to turn off. Can be negative
				orientation : 'horizontal', // indicate if the carousel should be 'horizontal' or 'vertical'
				activeClassName : 'carousel-center', // the name of the class given to the current item in the center
				keyboardNav : false, // set to true to move the carousel with the arrow keys
				keyboardNavOverride : true, // set to true to override the normal functionality of the arrow keys (prevents scrolling)
				imageNav : true, // clicking a non-center image will rotate that image to the center

				// preloader
				preloadImages : true, // disable/enable the image preloader.
				forcedImageWidth : 0, // specify width of all images; otherwise the carousel tries to calculate it
				forcedImageHeight : 0, // specify height of all images; otherwise the carousel tries to calculate it

				// callback functions
				movingToCenter : $.noop, // fired when an item is about to move to the center position
				movedToCenter : $.noop, // fired when an item has finished moving to the center
				clickedCenter : $.noop, // fired when the center item has been clicked
				doubleTappedCenter : $.noop, // fired when the center item has been clicked
				movingFromCenter : $.noop, // fired when an item is about to leave the center position
				movedFromCenter : $.noop // fired when an item has finished moving from the center
			};

			function initializeCarouselData() {
				mData = {
					itemsContainer : $(mCarousel),
					totalItems : $(mCarousel).find('section').length,
					containerWidth : $(mCarousel).width(),
					containerHeight : $(mCarousel).height(),
					currentCenterItem : null,
					previousCenterItem : null,
					items : [],
					calculations : [],
					carouselRotationsLeft : 0,
					currentlyMoving : false,
					itemsAnimating : 0,
					currentSpeed : options.speed,
					intervalTimer : null,
					currentDirection : 'forward',
					leftItemsCount : 0,
					rightItemsCount : 0,
					performingSetup : true
				};
				mData.itemsContainer.find('section').removeClass(options.activeClassName);
			}

			function forceImageDimensionsIfEnabled() {
				if (mOptions.forcedImageWidth && mOptions.forcedImageHeight) {
					mData.itemsContainer.find('section').each(function() {
						$(this).width(mOptions.forcedImageWidth);
						$(this).height(mOptions.forcedImageHeight);
					});
				}
			}


			this.startCarousel = function(newOptions) {
				if ( typeof newOptions === "object") {
					var combineDefaultWith = newOptions;
				} else {
					var combineDefaultWith = {};
				}
				mOptions = $.extend({}, mDefaultValues, newOptions);

				initializeCarouselData();
				mData.itemsContainer.find('section').hide();
				forceImageDimensionsIfEnabled();

				preload(function() {
					setOriginalItemDimensions();
					preCalculatePositionProperties();
					setupCarousel();
					setupStarterRotation();
				});
			};

			this.next = function() {
				autoPlay(true);
				mOptions.autoPlay = 0;

				moveOnce('forward');
			}
			this.prev = function() {
				autoPlay(true);
				mOptions.autoPlay = 0;

				moveOnce('backward');
			}

			$(this).find('a').bind("click", function(event) {
				var isCenter = $(this).find('section').data('currentPosition') == 0;
				// should we disable the links?
				if (mOptions.linkHandling === 1 || // turn off all links
				(mOptions.linkHandling === 2 && !isCenter))// turn off all links except center
				{
					event.preventDefault();
					return false;
				}
			});

			$(document).keydown(function(e) {
				if (mOptions.keyboardNav) {
					// arrow left or up
					if ((e.which === 37 && mOptions.orientation == 'horizontal') || (e.which === 38 && mOptions.orientation == 'vertical')) {
						autoPlay(true);
						mOptions.autoPlay = 0;
						moveOnce('backward');
						// arrow right or down
					} else if ((e.which === 39 && mOptions.orientation == 'horizontal') || (e.which === 40 && mOptions.orientation == 'vertical')) {
						autoPlay(true);
						mOptions.autoPlay = 0;
						moveOnce('forward');
					}
					// should we override the normal functionality for the arrow keys?
					if (mOptions.keyboardNavOverride && ((mOptions.orientation == 'horizontal' && (e.which === 37 || e.which === 39)) || (mOptions.orientation == 'vertical' && (e.which === 38 || e.which === 40))
					)) {
						e.preventDefault();
						return false;
					}
				}
			});

			$(this).find('section').on("touchstart", function(evt) {
				var itemPosition = $(this).data().currentPosition;

				if (mOptions.imageNav == false) {
					return;
				}
				// Don't allow hidden items to be clicked
				if (Math.abs(itemPosition) >= mOptions.flankingItems + 1) {
					return;
				}
				// Do nothing if the carousel is already moving
				if (mData.currentlyMoving) {
					return;
				}

				mData.previousCenterItem = mData.currentCenterItem;

				// Remove autoplay
				autoPlay(true);
				mOptions.autoPlay = 0;

				var rotations = Math.abs(itemPosition);
				if (itemPosition == 0) {
					$(this).applyTouches(evt, function() {
						mOptions.clickedCenter($(this));
					}, function() {
						mOptions.doubleTappedCenter($(this));
					});
				} else {
					// Fire the 'moving' callbacks
					mOptions.movingFromCenter(mData.currentCenterItem);
					mOptions.movingToCenter($(this));
					if (itemPosition < 0) {
						mData.currentDirection = 'backward';
						rotateCarousel(rotations);
					} else if (itemPosition > 0) {
						mData.currentDirection = 'forward';
						rotateCarousel(rotations);
					}
				}
			});

			function setupStarterRotation() {
				mOptions.startingItem = (mOptions.startingItem === 0) ? Math.round(mData.totalItems / 2) : mOptions.startingItem;

				mData.rightItemsCount = Math.ceil((mData.totalItems - 1) / 2);
				mData.leftItemsCount = Math.floor((mData.totalItems - 1) / 2);

				// We are in effect rotating the carousel, so we need to set that
				mData.carouselRotationsLeft = 1;

				// Center item
				moveItem(mData.items[mOptions.startingItem - 1], 0);
				mData.items[mOptions.startingItem - 1].css('opacity', 1);

				// All the items to the right of center
				var itemIndex = mOptions.startingItem - 1;
				for (var pos = 1; pos <= mData.rightItemsCount; pos++) {
					(itemIndex < mData.totalItems - 1) ? itemIndex += 1 : itemIndex = 0;

					mData.items[itemIndex].css('opacity', 1);
					moveItem(mData.items[itemIndex], pos);
				}

				// All items to left of center
				var itemIndex = mOptions.startingItem - 1;
				for (var pos = -1; pos >= mData.leftItemsCount * -1; pos--) {
					(itemIndex > 0) ? itemIndex -= 1 : itemIndex = mData.totalItems - 1;
					mData.items[itemIndex].css('opacity', 1);
					moveItem(mData.items[itemIndex], pos);
				}
			}

			function performCalculations($item, newPosition) {
				var newDistanceFromCenter = Math.abs(newPosition);

				// Distance to the center
				if (newDistanceFromCenter < mOptions.flankingItems + 1) {
					var calculations = mData.calculations[newDistanceFromCenter];
				} else {
					var calculations = mData.calculations[mOptions.flankingItems + 1];
				}

				var distanceFactor = Math.pow(mOptions.sizeMultiplier, newDistanceFromCenter)
				var newWidth = distanceFactor * $item.data('original_width');
				var newHeight = distanceFactor * $item.data('original_height');
				var widthDifference = Math.abs($item.width() - newWidth);
				var heightDifference = Math.abs($item.height() - newHeight);

				var newOffset = calculations.offset
				var newDistance = calculations.distance;
				if (newPosition < 0) {
					newDistance *= -1;
				}

				if (mOptions.orientation == 'horizontal') {
					var center = mData.containerWidth / 2;
					var newLeft = center + newDistance - (newWidth / 2);
					var newTop = mOptions.horizon - newOffset - (newHeight / 2);
				} else {
					var center = mData.containerHeight / 2;
					var newLeft = mOptions.horizon - newOffset - (newWidth / 2);
					var newTop = center + newDistance - (newHeight / 2);
				}

				var newOpacity;
				if (newPosition === 0) {
					newOpacity = 1;
				} else {
					newOpacity = calculations.opacity;
				}

				// Depth will be reverse distance from center
				var newDepth = mOptions.flankingItems + 2 - newDistanceFromCenter;
				if (!mOptions.leftAnimate) {
					newLeft = 0;
				}
				$item.data('width', newWidth);
				$item.data('height', newHeight);
				$item.data('top', newTop);
				$item.data('left', newLeft);
				$item.data('oldPosition', $item.data('currentPosition'));
				$item.data('depth', newDepth);
				$item.data('opacity', newOpacity);
			}

			function moveItem($item, newPosition) {
				// Only want to physically move the item if it is within the boundaries
				// or in the first position just outside either boundary
				if (Math.abs(newPosition) <= mOptions.flankingItems + 1) {
					performCalculations($item, newPosition);

					mData.itemsAnimating++;

					$item.css('z-index', $item.data().depth)
					// Animate the items to their new position values
					.animate({
						left : $item.data().left,
						width : $item.data().width,
						height : $item.data().height,
						top : $item.data().top,
						opacity : $item.data().opacity
					}, mData.currentSpeed, mOptions.animationEasing, function() {
						// Animation for the item has completed, call method
						itemAnimationComplete($item, newPosition);
					});

				} else {
					$item.mData('currentPosition', newPosition)
					// Move the item to the 'hidden' position if hasn't been moved yet
					// This is for the intitial setup
					if ($item.data('oldPosition') === 0) {
						$item.css({
							'left' : $item.data().left,
							'width' : $item.data().width,
							'height' : $item.data().height,
							'top' : $item.data().top,
							'opacity' : $item.data().opacity,
							'z-index' : $item.data().depth
						});
					}
				}

			}

			function itemAnimationComplete($item, newPosition) {
				mData.itemsAnimating--;

				$item.data('currentPosition', newPosition);

				// Keep track of what items came and left the center position,
				// so we can fire callbacks when all the rotations are completed
				if (newPosition === 0) {
					mData.currentCenterItem = $item;
				}

				// all items have finished their rotation, lets clean up
				if (mData.itemsAnimating === 0) {
					mData.carouselRotationsLeft -= 1;
					mData.currentlyMoving = false;

					// If there are still rotations left in the queue, rotate the carousel again
					// we pass in zero because we don't want to add any additional rotations
					if (mData.carouselRotationsLeft > 0) {
						rotateCarousel(0);
						// Otherwise there are no more rotations and...
					} else {
						// Reset the speed of the carousel to original
						mData.currentSpeed = mOptions.speed;

						mData.currentCenterItem.addClass(mOptions.activeClassName);

						if (mData.performingSetup === false) {
							mOptions.movedToCenter(mData.currentCenterItem);
							mOptions.movedFromCenter(mData.previousCenterItem);
						}

						mData.performingSetup = false;
						// reset & initate the autoPlay
						autoPlay();
					}
				}
			}

			function autoPlay(stop) {
				// clear timer
				clearTimeout(mData.autoPlayTimer);
				// as long as no stop command, and autoplay isn't zeroed...
				if (!stop && mOptions.autoPlay !== 0) {
					// set timer...
					mData.autoPlayTimer = setTimeout(function() {
						// to move the carousl in either direction...
						if (mOptions.autoPlay > 0) {
							moveOnce('forward');
						} else {
							moveOnce('backward');
						}
					}, Math.abs(mOptions.autoPlay));
				}
			}

			function nextItemFromCenter() {
				var $next = mData.currentCenterItem.next();
				if ($next.length <= 0) {
					$next = mData.currentCenterItem.parent().children().first();
				}
				return $next;
			}

			function prevItemFromCenter() {
				var $prev = mData.currentCenterItem.prev();
				if ($prev.length <= 0) {
					$prev = mData.currentCenterItem.parent().children().last();
				}
				return $prev;
			}

			function moveOnce(direction) {
				if (mData.currentlyMoving === false) {
					mData.previousCenterItem = mData.currentCenterItem;

					mOptions.movingFromCenter(mData.currentCenterItem);
					if (direction == 'backward') {
						mOptions.movingToCenter(prevItemFromCenter());
						mData.currentDirection = 'backward';
					} else if (direction == 'forward') {
						mOptions.movingToCenter(nextItemFromCenter());
						mData.currentDirection = 'forward';
					}
				}
				rotateCarousel(1);
			}

			function rotateCarousel(rotations) {
				// Check to see that a rotation is allowed
				if (mData.currentlyMoving === false) {

					// Remove active class from the center item while we rotate
					mData.currentCenterItem.removeClass(options.activeClassName);

					mData.currentlyMoving = true;
					mData.itemsAnimating = 0;
					mData.carouselRotationsLeft += rotations;

					if (options.quickerForFurther === true) {
						// Figure out how fast the carousel should rotate
						if (rotations > 1) {
							mData.currentSpeed = options.speed / rotations;
						}
						// Assure the speed is above the minimum to avoid weird results
						mData.currentSpeed = (mData.currentSpeed < 100) ? 100 : mData.currentSpeed;
					}

					// Iterate thru each item and move it
					for (var i = 0; i < mData.totalItems; i++) {
						var $item = $(mData.items[i]);
						var currentPosition = $item.data('currentPosition');

						var newPosition;
						if (mData.currentDirection == 'forward') {
							newPosition = currentPosition - 1;
						} else {
							newPosition = currentPosition + 1;
						}
						// We keep both sides as even as possible to allow circular rotation to work.
						// We will "wrap" the item arround to the other side by negating its current position
						var flankingAllowance = (newPosition > 0) ? data.rightItemsCount : mData.leftItemsCount;
						if (Math.abs(newPosition) > flankingAllowance) {
							newPosition = currentPosition * -1;
							// If there's an uneven number of "flanking" items, we need to compenstate for that
							// when we have an item switch sides. The right side will always have 1 more in that case
							if (mData.totalItems % 2 == 0) {
								newPosition += 1;
							}
						}

						moveItem($item, newPosition);
					}
				}
			}

			function setupCarousel() {
				// Fill in a data array with jQuery objects of all the images
				mData.items = mData.itemsContainer.find('section');
				for (var i = 0; i < mData.totalItems; i++) {
					mData.items[i] = $(mData.items[i]);
				}

				// May need to set the horizon if it was set to auto
				if (mOptions.horizon === 0) {
					if (mOptions.orientation === 'horizontal') {
						mOptions.horizon = mData.containerHeight / 2;
					} else {
						mOptions.horizon = mData.containerWidth / 2;
					}
				}

				// Default all the items to the center position
				mData.itemsContainer.css('position', 'relative').find('section').each(function() {
					// Figure out where the top and left positions for center should be
					var centerPosLeft, centerPosTop;
					if (mOptions.orientation === 'horizontal') {
						centerPosLeft = (mData.containerWidth / 2) - ($(this).data('original_width') / 2);
						centerPosTop = mOptions.horizon - ($(this).data('original_height') / 2);
					} else {
						centerPosLeft = mOptions.horizon - ($(this).data('original_width') / 2);
						centerPosTop = (mData.containerHeight / 2) - ($(this).data('original_height') / 2);
					}
					if (!options.leftAnimate) {
						centerPosLeft = 0;
					}
					$(this)
					// Apply positioning and layering to the images
					.css({
						'left' : centerPosLeft,
						'top' : centerPosTop,
						'visibility' : 'visible',
						'position' : 'absolute',
						'z-index' : 0,
						'opacity' : 0
					})
					// Give each image a data object so it remembers specific data about
					// it's original form
					.data({
						top : centerPosTop,
						left : centerPosLeft,
						oldPosition : 0,
						currentPosition : 0,
						depth : 0,
						opacity : 0
					})
					// The image has been setup... Now we can show it
					.show();
				});
			}

			function preCalculatePositionProperties() {
				// The 0 index is the center item in the carousel
				var $firstItem = mData.itemsContainer.find('section:first');

				mData.calculations[0] = {
					distance : 0,
					offset : 0,
					opacity : 1
				}

				// Then, for each number of flanking items (plus one more, see below), we
				// perform the calcations based on our user options
				var horizonOffset = mOptions.horizonOffset;
				var separation = mOptions.separation;
				for (var i = 1; i <= mOptions.flankingItems + 2; i++) {
					if (i > 1) {
						horizonOffset *= mOptions.horizonOffsetMultiplier;
						separation *= mOptions.separationMultiplier;
					}
					mData.calculations[i] = {
						distance : mData.calculations[i - 1].distance + separation,
						offset : mData.calculations[i - 1].offset + horizonOffset,
						opacity : mData.calculations[i - 1].opacity * mOptions.opacityMultiplier
					}
				}
				// We performed 1 extra set of calculations above so that the items that
				// are moving out of sight (based on # of flanking items) gracefully animate there
				// However, we need them to animate to hidden, so we set the opacity to 0 for
				// that last item
				if (mOptions.edgeFadeEnabled) {
					mData.calculations[mOptions.flankingItems + 1].opacity = 0;
				} else {
					mData.calculations[mOptions.flankingItems + 1] = {
						distance : 0,
						offset : 0,
						opacity : 0
					}
				}
			}

			function setOriginalItemDimensions() {
				mData.itemsContainer.find('section').each(function() {
					if ($(this).data('original_width') == undefined || mOptions.forcedImageWidth > 0) {
						$(this).data('original_width', $(this).width());
					}
					if ($(this).data('original_height') == undefined || mOptions.forcedImageHeight > 0) {
						$(this).data('original_height', $(this).height());
					}
				});
			}

			function preload(callback) {
				if (mOptions.preloadImages === false) {
					callback();
					return;
				}

				var $imageElements = mData.itemsContainer.find('section'), loadedImages = 0, totalImages = $imageElements.length;

				$imageElements.each(function() {
					$(this).on('load', function() {
						// Add to number of images loaded and see if they are all done yet
						loadedImages += 1;
						if (loadedImages === totalImages) {
							// All done, perform callback
							callback();
							return;
						}
					});
					// May need to manually reset the src to get the load event to fire
					// http://stackoverflow.com/questions/7137737/ie9-problems-with-jquery-load-event-not-firing
					$(this).attr('src', $(this).attr('src'));

					// If browser has cached the images, it may not call trigger a load. Detect this and do it ourselves
					if (this.complete) {
						$(this).trigger('load');
					}
				});
			}


			this.startCarousel(options);

			return this;

		};

	}(jQuery));
