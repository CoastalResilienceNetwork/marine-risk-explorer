define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/promise/all",
	"framework/PluginBase",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/WMSLayer",
	"esri/layers/FeatureLayer",
	"esri/geometry/Extent",
	"esri/SpatialReference",
	"esri/tasks/query",
	"esri/tasks/QueryTask",
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleLineSymbol",
	"esri/Color",
	"esri/graphic",
    'dojo/text!./region.json',
    'dojo/text!./print-setup.html',
    "dojo/text!./print_template.html",
    "dojo/text!./print_stat_template.html",
    "dojo/text!./template.html",
	], function(declare,
		lang,
		all,
		PluginBase,
		ArcGISDynamicMapServiceLayer,
		WMSLayer,
		FeatureLayer,
		Extent,
		SpatialReference,
		Query,
		QueryTask,
		SimpleFillSymbol,
		SimpleLineSymbol,
		Color,
		Graphic,
		RegionConfig,
		print_setup,
		print_template,
		print_stat_template,
		template
	) {
		return declare(PluginBase, {
			toolbarName: 'Coastal Risk Explorer', //content pane title
			fullName: 'Coastal Risk Explorer', //toolbar hover text
			resizable: false,
			width: 425,
			size: 'custom',
			allowIdentifyWhenActive: false,
			layers: {},
			hasCustomPrint: true,
			usePrintModal: true,
			printModalSize: [390, 330],
			selectedParcel: null,
			marshScenarioIdx: null,
			initialized: false,
			activated: false,
			currentTown: {"name": '', "data":{}},
			currentBlockGroup: {"name": '', "data":{}},
			qtTown: null,
			qTown: null,
			qtBlockGroup: null,
			qBlockGroup: null,
			stateObj: {},
			mapClickEvtObj: null,
			/** 
			 * Method: initialize
			 * 		The framework calls this during initial framework load from the file app\js\Plugin.js (approx line 70).
			 * Args:
			 * 		frameworkParameters {Object} - info about the external framework environment, including the app, map, legendContainer, and more
			*/
			initialize: function(frameworkParameters) {
				console.debug('Marine Risk Explorer; main.js; initialize()');
				declare.safeMixin(this, frameworkParameters);
				this.$el = $(this.container);
				this.regionConfig = $.parseJSON(RegionConfig);
				this.slrIdx = 0; // Scenario array index
				this.defaultExtent = new Extent(
					this.regionConfig.defaultExtent[0],
					this.regionConfig.defaultExtent[1],
					this.regionConfig.defaultExtent[2],
					this.regionConfig.defaultExtent[3],
					new SpatialReference({wkid: 102100})
				);
				//hide the print button at the top of the plugin window
				$(this.printButton).hide();
				
				//Load town names. Populates a local array of town names.
				var townQuery = new Query();
                var townQueryTask = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.townsLayer_ServiceIndex);
                townQuery.where = '1=1';
                townQuery.returnGeometry = false;
                townQuery.outFields = ['*'];
				townQueryTask.execute(townQuery, _.bind(this.loadTownsSuccess, this),_.bind(this.loadTownsError, this));

				//Init Query Tasks for map click
				this.qtTown = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.townsLayer_ServiceIndex);
				this.qTown = new Query();
				this.qTown.outFields = ['*'];
				this.qTown.returnGeometry = true;

				this.qtBlockGroup = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.blockGroupLayer_ServiceIndex);
				this.qBlockGroup = new Query();
				this.qBlockGroup.outFields = ['*'];
				this.qBlockGroup.returnGeometry = true;
				this.qBlockGroup.where = '1=1';

				// Graphic Symbols
				this.townSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([255,204,0,1]), //color
						5 //width
					),
					new Color([255, 255, 255, 0]) //white, completely transparent
				);
				this.townSelectedSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([255,204,0,1]), //color
						5 //width
					),
					new Color([255, 255, 255, 0]) //white, completely transparent
				);

				this.blockGroupSelectedSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([235,235,235 ,1]), //color
						3 //width
					),
					new Color([255, 255, 255, 0]) //white, completely transparent
				);
			},
			/** 
			 * Method: activate
			 * 		The framework calls this when the user clicks on the toolbar button to use this plugin. 
			 * 		(Most likely called from the onSelectionChanged handler of app\js\Plugin.js approx line 205)
			 * Args:
			 * 		arg {boolean} - if above assumption is true, then the arg value is to direct supression of help at startup. Currently not used.
			*/			
			activate: function() {
				console.debug('Marine Risk Explorer; main.js; activate()');
				if(!this.activated){
					//console.debug('Not Activated: Activating');
					this.map.setExtent(this.defaultExtent);
					//TODO eliminate need for self = this;
					var self = this;

					this.layers = {};
					// Only set the extent the first time the app is activated
					
					
					// NOTE Order added here is important because it is draw order on the map
					// First in draws below others, etc. Last in draws on top.
					if (this.regionConfig.lidar && !this.layers.lidar) {
						this.layers.lidar = new WMSLayer(this.regionConfig.lidar, {
							visible: false,
							visibleLayers: this.regionConfig.lidarLayers
						});
						this.map.addLayer(this.layers.lidar);
					}
					//DYNAMIC MAP SERVICE LAYERS

					//Sea Level
					// if (this.regionConfig.service && !this.layers.seaLevelRise) {
					// 	this.layers.seaLevelRise = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
					// 		id: 'seaLevelRise'
					// 	});
					// 	this.layers.seaLevelRise.setVisibleLayers([this.regionConfig.scenarios[0].layer]);
					// 	this.map.addLayer(this.layers.seaLevelRise);
					// }
					//All layers
					if (this.regionConfig.service && !this.layers.coastalRisk) {
						this.layers.coastalRisk = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
							id: 'coastalRisk'
						});
						
						this.layers.coastalRisk.setVisibleLayers(this.regionConfig.visibleLayerGroups.default);
						this.map.addLayer(this.layers.coastalRisk);
					}


					//Road Stream Crossing
					if (this.regionConfig.service && !this.layers.roadStreamCrossing) {
						this.layers.roadStreamCrossing = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
							id: 'roadStreamCrossing',
							visible:false
						});
						this.layers.roadStreamCrossing.setVisibleLayers([this.regionConfig.roadStreamCrossing_ServiceIndex]);
						this.map.addLayer(this.layers.roadStreamCrossing);
					}	

					//GRAPHICS LAYERS
					//Town graphic layers (important that these are created before the Feature Layer. Otherwise there is mouse-over/mouse-out mayhem for the feature layer, at least in chrome)
					if(!this.layers.selectedTownGraphics){
						this.layers.selectedTownGraphics = new esri.layers.GraphicsLayer();
						this.map.addLayer(this.layers.selectedTownGraphics);
					}
					if(!this.layers.townGraphics){
						this.layers.townGraphics = new esri.layers.GraphicsLayer({
							//maxScale: 36111.911040
						});
						this.map.addLayer(this.layers.townGraphics);
					}
					//Block Group graphic layers (important that these are created before the Feature Layer. Otherwise there is mouse-over/mouse-out mayhem for the feature layer, at least in chrome)
					if(!this.layers.selectedBlockGroupGraphics){
						this.layers.selectedBlockGroupGraphics = new esri.layers.GraphicsLayer();
						this.map.addLayer(this.layers.selectedBlockGroupGraphics);
					}

					this.layers.townFL = new FeatureLayer(this.regionConfig.service + '/' + this.regionConfig.townsLayer_ServiceIndex, {
						mode: FeatureLayer.MODE_SNAPSHOT,
						outFields: ['OBJECTID']
					});
					this.map.addLayer(this.layers.townFL);

					// // Set marsh scenario.  Will default to 0 unless a share link was used to initalize different values
					// this.setMarshScenario(this.slrIdx);
					// this.$el.find("#salt-marsh-slider").slider("value", this.slrIdx);

					
					this.render();
				}

				this.activated = true;
			},
			/** 
			 * Method: render
			 * 		
			 * Args:
			 * 		
			*/
			render: function() {
				console.debug('Marine Risk Explorer; main.js; render()');
				var self = this;

				var saltMarshLabels = this.regionConfig.scenarios.map(function(scenario) {
                	return scenario.label;
				});
				
				this.$el.html(_.template(template)({
					disclaimer: this.regionConfig.disclaimer,
					intro: this.regionConfig.intro,
					townLabel: this.regionConfig.townLabel,
					globalRegion: this.regionConfig.globalRegion,
					towns: this.townNames,
					region: this.region,
					reportItems: this.regionConfig.report.items, 
					lidar: this.regionConfig.lidar,
					current_conservation_lands: Number.isInteger(this.regionConfig.current_conservation_lands),
					wildlife_habitat: Number.isInteger(this.regionConfig.wildlife_habitat),
					non_tidal_wetlands: Number.isInteger(this.regionConfig.non_tidal_wetlands),
					road_stream_crossing: Number.isInteger(this.regionConfig.roadStreamCrossing_ServiceIndex)
                }));

				//Town picker drop down list, jquery autocomplete (as combobox);
				$.widget( "custom.combobox", {
					_create: function() {
						this.wrapper = $( "<span>" )
							.addClass( "custom-combobox" )
							.insertAfter( this.element );
						this.element.hide();
						this._createAutocomplete();
						this._createShowAllButton();
					},
					_createAutocomplete: function() {
						var selected = this.element.children( ":selected" ),
							value = selected.val() ? selected.text() : "";
						this.input = $( "<input>" )
							.appendTo( this.wrapper )
							.val( value )
							.attr( "title", "" )
							.addClass( "custom-combobox-input ui-widget ui-widget-content ui-state-default ui-corner-left" )
							.autocomplete({
								delay: 0,
								minLength: 0,
								source: $.proxy( this, "_source" )
							})
							.tooltip({
								classes: {
									"ui-tooltip": "ui-state-highlight"
								}
							});
						this._on( this.input, {
							autocompleteselect: function( event, ui ) {
								ui.item.option.selected = true;
								this._trigger( "select", event, {
									item: ui.item.option
								});
								var qt = new QueryTask(self.regionConfig.service + '/' +self.regionConfig.townsLayer_ServiceIndex);
								var q = new Query();
								q.where = self.regionConfig.townsLayer_NameField + " = '" + ui.item.option.value + "'";
								q.outFields = ['*'];
								q.returnGeometry = true;
								qt.execute(q, lang.hitch(self,function(featSet){
									//console.debug('query task success:', featSet);
									if(featSet.features.length >= 1){
										self.setCurrentBlockGroup({});
										self.clearSelectedBlockGroupGraphics();
										self.setCurrentTown(featSet.features[0]);
										self.zoomToTown(featSet.features[0]);
										self.updateMetrics('town', self.$el.find("#salt-marsh-slider").slider("value"));
									}
								}), lang.hitch(self,function(err){
									console.error('query task error:',err);
								}));
							},
							autocompletechange: "_removeIfInvalid"
						});
					},
					_createShowAllButton: function() {
						var input = this.input,
						wasOpen = false;
						$( "<a>" )
							.attr( "tabIndex", -1 )
							.attr( "title", "Show All Items" )
							.tooltip()
							.appendTo( this.wrapper )
							.button({
								icons: {
								primary: "ui-icon-triangle-1-s"
								},
								text: false
							})
							.removeClass( "ui-corner-all" )
							.addClass( "custom-combobox-toggle ui-corner-right" )
							.on( "mousedown", function() {
								wasOpen = input.autocomplete( "widget" ).is( ":visible" );
							})
							.on( "click", function() {
								input.trigger( "focus" );
								// Close if already visible
								if ( wasOpen ) {
									return;
								}
								// Pass empty string as value to search for, displaying all results
								input.autocomplete( "search", "" );
							});
					},
					_source: function( request, response ) {
						var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
						response( this.element.children( "option" ).map(function() {
							var text = $( this ).text();
							if ( this.value && ( !request.term || matcher.test(text) ) )
								return {
									label: text,
									value: text,
									option: this
								};
						}));
					},
				
					_removeIfInvalid: function( event, ui ) {
						// Selected an item, nothing to do
						if ( ui.item ) {
							return;
						}
						// Search for a match (case-insensitive)
						var value = this.input.val(),
						valueLowerCase = value.toLowerCase(),
						valid = false;
						this.element.children( "option" ).each(function() {
							if ( $( this ).text().toLowerCase() === valueLowerCase ) {
								this.selected = valid = true;
								return false;
							}
						});
						// Found a match, nothing to do
						if ( valid ) {
							return;
						}
						// Remove invalid value
						this.input
							.val( "" )
							.attr( "title", value + " didn't match any item" )
							.tooltip( "open" );
						this.element.val( "" );
						this._delay(function() {
							this.input.tooltip( "close" ).attr( "title", "" );
						}, 2500 );
						this.input.autocomplete( "instance" ).term = "";
					},
					_destroy: function() {
						this.wrapper.remove();
						this.element.show();
					}
				});
				
				$( "#combobox" ).combobox();
				$( "#toggle" ).on( "click", function() {
					$( "#combobox" ).toggle();
				});

				//Sea Level Rise slider
                this.$el.find("#salt-marsh-slider").slider({
            		min: 0,
            		max: saltMarshLabels.length - 1,
            		range: false,
            		change: function(e, ui) {
						//can I use _.bind() here instead of creating the self obj.? or lang.hitch() from dojo
						self.$el.find('.salt-marsh-control').attr('data-scenario-idx', ui.value);
            			self.setMarshScenario(ui.value); 
            		}
				}).slider('pips',  { 
					rest: 'label',
					labels: saltMarshLabels,
				});

				//Sea Level layer transparency slider
                this.$el.find(".transparency-slider .slider").slider({
            		min: 0,
            		max: 100,
            		step: 1,
            		value: [100],
            		range: false,
            		slide: function(e, ui) {
            			var control = $(e.target).parents('.transparency-control');
            			control.attr('data-opacity', ui.value);
             			var layer = control.first().data('layer');
						control.find('.value').html(ui.value + '%');
						self.layers[layer].setOpacity(ui.value / 100);
            		}
				});

				//Social Vulnerability slider (for percentage score)
				var handle = $( "#custom-handle" );
				$( "#sv_slider" ).slider({
					range: 'min',
					min:0,
					max:100,
					create: function() {
						handle.text( $( this ).slider( "value" ) );
					},
					slide: function( event, ui ) {
						return false;
					}
				});

				this.bindEvents();
			},
			/** 
			 * Method: bindEvents
			 * 		
			 * Args:
			 * 		
			*/			
			bindEvents: function() {
				console.debug('Marine Risk Explorer; main.js; bindEvents()');
				var self = this;
				this.$el.find('.info').tooltip({

				});
				//map and layer events
				var townsOnMouseOver = this.layers.townFL.on('mouse-over', lang.hitch(this,function(evt) {
					//console.debug("towns mouse-over!");
					if (this.layers.townGraphics.graphics.length === 0){
						var highlightGraphic = new Graphic(evt.graphic.geometry, this.townSymbol, evt.graphic.attributes);
						this.layers.townGraphics.add(highlightGraphic);
					}
				}));
				var townsOnMouseOut = this.layers.townFL.on('mouse-out', lang.hitch(this, function(evt) {
					//console.debug("towns mouse-out!");
					if (this.layers.townGraphics.graphics.length >= 1){
						this.layers.townGraphics.clear();
					}
				}));
				this.marineRiskMapClickEvent = this.map.on('click', lang.hitch(this, function(evt) { 
					//console.debug("map click!", evt);
					this.qBlockGroup.where = '1=1';
					this.qBlockGroup.geometry = evt.mapPoint;
					var deferredBlockGroup = this.qtBlockGroup.execute(this.qBlockGroup);
					//Town Check: is BG still in the currently selected town? If not, change town selection in map and in DDL, but do not fire on-change for the DDL.
					this.qTown.where = '1=1';
					this.qTown.geometry = evt.mapPoint;
					var deferredTown = this.qtTown.execute(this.qTown);
					//using dojo/promise/all to group these two async queries (promises) and handle after all are complete. Otherwise nasty race-condition errors.
					all([deferredBlockGroup, deferredTown]).then(lang.hitch(this,function(featSets){
						//console.debug('all() deferred results: ', featSets);
						try{
							//Block Group
							if (featSets[0].features.length >= 1){
								this.setCurrentBlockGroup(featSets[0].features[0]);
								//this.zoomToBlockGroup(featSets[0].features[0]);
								this.clearSelectedBlockGroupGraphics();
								this.drawSelectedBlockGroupGraphics(featSets[0].features[0]);
								this.updateBlockGroupName(featSets[0].features[0].attributes[this.regionConfig.blockGroupLayer_NameField]);
								//Town Check
								if (featSets[1].features.length >= 1){
									if(featSets[1].features[0].attributes[this.regionConfig.townsLayer_NameField] != this.currentTown.name){
										console.debug('town names do not match, change selected town');
										this.clearSelectedTownGraphics();
										this.drawSelectedTownGraphics(featSets[1].features[0]);
										this.setCurrentTown(featSets[1].features[0]);
										//Update the town ddl to the new town.
										this.$el.find('.custom-combobox-input').val(featSets[1].features[0].attributes[this.regionConfig.townsLayer_NameField]);
									}else {
										console.debug('town names match');
									}
								} else {
									console.debug('No Towns Found');
								}
								this.updateMetrics('blockgroup',this.$el.find("#salt-marsh-slider").slider("value"));
							} else {
								console.debug('No Block Groups Found');
							}
						}catch(err){
							console.error('map click data processing error:',err);
						}
					}));
				}));

				this.$el.find('.transparency-label').on('mousedown', function() {
					var control = $(this).parent('.transparency-control').toggleClass('open');
					var dataLayer = control.attr('data-layer');
					if (control.hasClass('open')) {
						$('body').on('click.tranSlider', function(e) {
							if ($(e.target).parents('.transparency-control[data-layer=' + dataLayer + ']').length || ($(e.target).hasClass('transparency-control') && $(e.target).attr('data-layer') === dataLayer)) {
								// Do nothing
							} else {
								control.removeClass('open');
								$('body').off('click.tranSlider');
							}
						});
					}
				});

				this.$el.find('.carrotToggle').on('click',lang.hitch(this,function(a,b,c){
					$('.stats .stat .statGrid').toggleClass('active');
					if($('.stats .stat .statGrid').hasClass('active')){
						this.$el.find('.carrotToggle').html('Hide Details');
					}else{
						this.$el.find('.carrotToggle').html('Show Details');
					}
				}));

				//Additional Layers checkboxes
				this.$el.find('.layer input').on('change', function(e) {
					var checked = this.checked;
					var layer = $(e.target).parents('.layer');

					self.layers[$(this).data('layer')].setVisibility(checked);

					if (checked) {
						layer.find('.transparency-control').css('display', 'inline-block');
					} else {
						layer.find('.transparency-control').css('display', 'none');
					}
				});
				//Print Report - triggers the click event on the native print. See prePrintModal() and postPrintModal() methods in this file for print handling logic.
				this.$el.find('.export .print').on('click', function() {
					self.$el.parent('.sidebar').find('.plugin-print').trigger('click');
				});
				//Data Notes - opens the notes.html content
				this.$el.find('.export .notes').on('click', function() {
					TINY.box.show({
				        animate: true,
				        url: 'plugins/marine-risk-explorer/notes.html',
				        fixed: true,
				        width: 560,
				        height: 700
				    });
				});
				//save and share handling
				this.layers.coastalRisk.on("load", lang.hitch(this,function(){
					//console.debug('coastalRisk load!', this.stateObj);
					//Check Save-n-Share State, update UI if opening from a Save-n-Share link
					//If there is a Block Group, get both Block Group and Town info.
					if(this.stateObj && this.stateObj.hasOwnProperty('blockGroupOID')){
						//block group and town
						//console.debug('running Block Group and Town async queries');
						this.qBlockGroup.where = "OBJECTID = " + this.stateObj.blockGroupOID;
						var deferredBG = this.qtBlockGroup.execute(this.qBlockGroup);
						this.qTown.where = "OBJECTID = " + this.stateObj.townOID;
						var deferredT = this.qtTown.execute(this.qTown);
						var sliderIndex = this.stateObj.slrIdx;
						//using dojo/promise/all to group these two async queries (promises) and handle after all are complete. Otherwise nasty race-condition errors.
						all([deferredBG, deferredT]).then(lang.hitch(this,function(featSets){
							console.debug('all() deferred results: featSets: ', featSets);
							console.debug('all() deferred results: this.stateObj: ', this.stateObj);
							console.debug('all() deferred results: sliderIndex: ', sliderIndex);
							try{
								//Block Group
								if (featSets[0].features.length >= 1){
									this.setCurrentBlockGroup(featSets[0].features[0]);
									this.zoomToBlockGroup(featSets[0].features[0]);
									this.updateBlockGroupName(featSets[0].features[0].attributes[this.regionConfig.blockGroupLayer_NameField]);
									
									//Town Check
									if (featSets[1].features.length >= 1){
										if(featSets[1].features[0].attributes[this.regionConfig.townsLayer_NameField] != this.currentTown.name){
											console.debug('town names do not match, change selected town');
											this.clearSelectedTownGraphics();
											this.drawSelectedTownGraphics(featSets[1].features[0]);
											this.setCurrentTown(featSets[1].features[0]);
											//Update the town ddl to the new town.
											this.$el.find('.custom-combobox-input').val(featSets[1].features[0].attributes[this.regionConfig.townsLayer_NameField]);
										}else {
											console.debug('town names match');
										}
									} else {
										console.debug('No Towns Found');
									}
									//set slider
									this.$el.find("#salt-marsh-slider").slider("value", sliderIndex);
									//initiate getting metrics
									this.setMarshScenario(sliderIndex);
									//this.stateObj = {};
								} else {
									console.debug('No Block Groups Found');
								}
								
							}catch(err){
								console.error('save and share data processing error:',err);
							}
						}));
					} else if(this.stateObj && this.stateObj.hasOwnProperty('townOID')){
						//town only
						console.debug('Using save-and-share for Town only');
						console.debug(this.stateObj);
						this.qTown.where = "OBJECTID = " + this.stateObj.townOID;
						var sliderIndex = this.stateObj.slrIdx;
						this.qtTown.execute(this.qTown, lang.hitch(this,function(featSet){
							console.debug('town query success: featSet = ', featSet);
							console.debug('town query success: slider index = ', sliderIndex);
							if(featSet.features.length >= 1){
								this.setCurrentBlockGroup({});
								this.clearSelectedBlockGroupGraphics();
								this.setCurrentTown(featSet.features[0]);
								this.zoomToTown(featSet.features[0]);
								//Update the town ddl to the new town.
								this.$el.find('.custom-combobox-input').val(featSet.features[0].attributes[this.regionConfig.townsLayer_NameField]);
								//set slider
								this.$el.find("#salt-marsh-slider").slider("value", sliderIndex);
								//initiate getting metrics
								this.setMarshScenario(sliderIndex);
							}
						}), lang.hitch(this, function(err){
							console.debug('town query error: err = ', err);
						}));
					}
				}));
			},
			/** 
			 * Method: deactivate
			 * 		Called by the framework when the user minimizes this Plugin (by either clicking on the toolbar icon for this plugin when the plugin is already open 
			 * 		or using the minimize ('_') button in the top right corner of the plugin window.
			 * Args:
			 * 		
			*/
			deactivate: function() {
				console.debug('Marine Risk Explorer; main.js; deactivate()');
				_.each(Object.keys(this.layers), function(layer) {
					this.map.removeLayer(this.layers[layer]);
				}, this);
				this.layers = {};
				//house cleaning
				this.currentTown = {"name": '', "data":{}};
				this.currentBlockGroup = {"name": '', "data":{}};
				//remove map click event
				this.marineRiskMapClickEvent.remove();
				this.activated = false;
			},
			/** 
			 * Method: hibernate
			 * 		Called by the framework when the user closes this plugin by clicking on the close button ('x') in the top right corner of the Plugin window. 
			 * 		Note: deactivate() is called first.
			 * Args:
			 * 		
			*/
			hibernate: function() {
				console.debug('Marine Risk Explorer; main.js; hibernate()');

				// _.each(Object.keys(this.layers), function(layer) {
				// 	this.map.removeLayer(this.layers[layer]);
				// }, this);

				// TODO: Cleanup map click events


			},
			/** 
			 * Method: getState
			 * 		Used by the framework's 'Save And Share' feature as an override method for the plugin to pass plugin-specific data to the framework URL creation process.
			 * 		Note: No need to pass current map extents out as the framework appears to handle that.
			 * Args:
			 * 		
			*/
			getState: function(data) {
				console.debug('marine_risk_explorer; main.js; getState()');
				this.stateObj = {};
				if (this.currentBlockGroup.hasOwnProperty('data') && this.currentBlockGroup.data.hasOwnProperty('OBJECTID')){
					this.stateObj.blockGroupOID = this.currentBlockGroup.data.OBJECTID;
				}
				if (this.currentTown.hasOwnProperty('data') && this.currentTown.data.hasOwnProperty('OBJECTID')){
					this.stateObj.townOID = this.currentTown.data.OBJECTID;	
				}
				this.stateObj.slrIdx = this.$el.find("#salt-marsh-slider").slider("value");
				return this.stateObj;
            },
			/** 
			 * Method: setState
			 * 		Called by the framework with info from the google link created in the 'save and share' process.
			 * 		Called after initialize(), but before activate().
			 * Args:
			 * 		data {object} - The object of values as they were set in getState(), with the addition of a 'mainToggleChecked' property
			 * 		
			*/
			setState: function(data) {
				console.debug('Marine Risk Explorer; main.js; setState()',data);
				this.stateObj = data;
			},
			
            /** 
			 * Method: loadTownsSuccess
			 * 		
			 * Args:
			 * 		qeuryResults {object} - an object of features as returned by arcgis server's query task
			*/
			loadTownsSuccess:function(queryResults){
				console.debug('Marine Risk Explorer; main.js; loadTownsSuccess()');
				this.townNames = [];
				$.each(queryResults.features, _.bind(function(idx, feat){
					this.townNames.push(feat.attributes[this.regionConfig.townsLayer_NameField]);
				},this));
			},
			/** 
			 * Method: loadTownsError
			 * 		
			 * Args:
			 * 		err {object} - an error object as returned by arcgis server's query task
			*/
			loadTownsError:function(err){
				console.debug('Marine Risk Explorer; main.js; loadTownsError()');
				console.error(err);
				//TODO error handling for plugin on town load failure
			},
			/** 
			 * Method: zoomToTown
			 * 		
			 * Args:
			 * 		town {type: string OR object} - The town arg may be the name of a town, or an esri town Graphic.
			*/
			zoomToTown: function(town){
				console.debug('Marine Risk Explorer; main.js; zoomToTown()');
				var argType = typeof town;
				switch(argType){
					case "string":
						var qt = new QueryTask(this.regionConfig.service + '/' +this.regionConfig.townsLayer_ServiceIndex);
						var q = new Query();
						q.where = this.regionConfig.townsLayer_NameField + " = '" + town + "'";
						q.outFields = ['*'];
						q.returnGeometry = true;
						qt.execute(q, lang.hitch(this,function(featSet){
							console.debug('query task success:', featSet);
							this.clearSelectedTownGraphics();
							this.drawSelectedTownGraphics(featSet.features[0]);
							this.map.setExtent(featSet.features[0].geometry.getExtent(), true);
						}), lang.hitch(this,function(err){
							console.error('query task error:',err);
						}));
						break;
					case "object":
						if (town.hasOwnProperty('geometry')){
							this.clearSelectedTownGraphics();
							this.drawSelectedTownGraphics(town);
							this.map.setExtent(town.geometry.getExtent(), true);
						}else{
							console.error("zoomToTown Graphic obj error");
							return;
						}
						break;
					default:
						console.error("zoomToTown arg type error");
						return;
				}
			},
			/** 
			 * Method: zoomToBlockGroup
			 * 		
			 * Args:
			 * 		bgGraphic {type: object} - An esri block group Graphic object.
			*/
			zoomToBlockGroup: function(bgGraphic){
				console.debug('Marine Risk Explorer; main.js; zoomToBlockGroup()');
				this.clearSelectedBlockGroupGraphics();
				this.drawSelectedBlockGroupGraphics(bgGraphic);
				this.map.setExtent(bgGraphic.geometry.getExtent(), true);
			},

			/** 
			 * Method: drawSelectedTownGraphics
			 * 		
			 * Args:
			 *
			*/			
			drawSelectedTownGraphics: function(feat){
				var highlightGraphic = new Graphic(feat.geometry, this.townSelectedSymbol, feat.attributes);
				this.layers.selectedTownGraphics.add(highlightGraphic);
			},
			/** 
			 * Method: drawSelectedBlockGroupGraphics
			 * 		
			 * Args:
			 *
			*/
			drawSelectedBlockGroupGraphics:function(feat){
				var highlightGraphic = new Graphic(feat.geometry, this.blockGroupSelectedSymbol, feat.attributes);
				this.layers.selectedBlockGroupGraphics.add(highlightGraphic);
			},
			/** 
			 * Method: clearSelectedTownGraphics
			 * 		
			 * Args:
			 *
			*/
			clearSelectedTownGraphics: function(){
				if (this.layers.selectedTownGraphics) {
					this.layers.selectedTownGraphics.clear();	
				}
			},
			/** 
			 * Method: clearSelectedBlockGroupGraphics
			 * 		
			 * Args:
			 *
			*/
			clearSelectedBlockGroupGraphics: function(){
				if (this.layers.selectedBlockGroupGraphics) {
					this.layers.selectedBlockGroupGraphics.clear();	
				}
			},
			/** 
			 * Method: setCurrentTown
			 * 		
			 * Args:
			 * 		feat {type: object} - expecting either an esri feature object, or an empty ({}) object.
			*/	
			setCurrentTown: function(feat){
				console.debug('Marine Risk Explorer; main.js; setCurrentTown()');
				try{
					//check for feature
					if (feat.hasOwnProperty('attributes')){
						this.currentTown.name = feat.attributes[this.regionConfig.townsLayer_NameField];
						this.currentTown.data = feat.attributes;
					}else{
						this.currentTown.name = '';
						this.currentTown.data = {};
						this.currentBlockGroup.name = '';
						this.currentBlockGroup.data = {};
					}
				}catch (ex){
					console.error('Error; Marine Risk Explorer; main.js; setCurrentTown()');
				}
			},
			/** 
			 * Method: setCurrentBlockGroup
			 * 		
			 * Args:
			 * 		feat {type: object} - expecting either an esri feature object, or an empty ({}) object.
			*/	
			setCurrentBlockGroup: function(feat){
				console.debug('Marine Risk Explorer; main.js; setCurrentBlockGroup()');
				try{
					//check for feature
					if (feat.hasOwnProperty('attributes')){
						this.currentBlockGroup.name = feat.attributes[this.regionConfig.blockGroupLayer_NameField];
						this.currentBlockGroup.data = feat.attributes;
					}else{
						this.currentBlockGroup.name = '';
						this.currentBlockGroup.data = {};
					}
				}catch (ex){
					console.error('Error; Marine Risk Explorer; main.js; setCurrentBlockGroup()');
				}
			},			
			/** 
			 * Method: updateBlockGroupName
			 * 		
			 * Args:
			 * 		name {type: string} - the name of the block group
			*/		
			updateBlockGroupName: function(name){
				try{
					//update the UI item
					this.$el.find("#blockGroupName").html(name);
				}catch (ex){
					console.error('Error; Marine Risk Explorer; main.js; updateBlockGroupName()');
				}
			},
			/** 
			 * Method: setMarshScenario
			 * 		
			 * Args:
			 * 		idx {number} - integer representing the slider index
			*/
			setMarshScenario: function(idx) {
				try{
					console.debug('Marine Risk Explorer; main.js; setMarshScenario() idx=', idx);
					this.idx = idx;

					// var layerIds = this.regionConfig.scenarios.map(function(scenario) {
					// 	return scenario.layer;
					// });
					// if (this.regionConfig.scenariosAdditive) {
					// 	console.debug('sea level layers are additive');
					// 	this.layers.seaLevelRise.setVisibleLayers(layerIds.slice(0, idx + 1));
					// } else {
					// 	console.debug('sea level layers are not additive');
					// 	this.layers.seaLevelRise.setVisibleLayers([layerIds[idx]]);
					// }
					// this.layers.seaLevelRise.refresh();

					//update other visible layers based on sea level setting
					var lyrAry = null;
					switch(idx){
						case 0:
							lyrAry = this.regionConfig.visibleLayerGroups.default;
							break;
						case 1:
							lyrAry = this.regionConfig.visibleLayerGroups.oneFoot;
							break;
						case 2:
							lyrAry = this.regionConfig.visibleLayerGroups.twoFoot;
							break;
						case 3:
							lyrAry = this.regionConfig.visibleLayerGroups.threeFoot;
							break;
						case 4:
							lyrAry = this.regionConfig.visibleLayerGroups.sixFoot;
							break;
					}
					console.debug(lyrAry);
					this.layers.coastalRisk.setVisibleLayers(lyrAry);
					this.layers.coastalRisk.refresh();
					//update data - if currentBlockGroup.data has an objedtid property, assume we are looking at a blockgroup, otherwise town
					console.debug('currentBlockGroup.data.hasOwnProperty("OBJECTID")?: ', this.currentBlockGroup.data.hasOwnProperty("OBJECTID"));
					if(this.currentBlockGroup.hasOwnProperty("data") && this.currentBlockGroup.data.hasOwnProperty("OBJECTID")){
						this.updateMetrics('blockgroup', idx);
					}else if(this.currentTown.hasOwnProperty("data") && this.currentTown.data.hasOwnProperty("OBJECTID")){
						this.updateMetrics('town', idx);
					}
				}catch(err){
					console.error('Set slider index errro: ', err);
				}
			},
			/** 
			 * Method: updateMetrics
			 * 		
			 * Args:
			 * 		category {type: string} - 'town' or 'blockgroup' expected
			 * 		seaLevelIndex {type: number} - Sea Level slider index position
			*/		
			updateMetrics: function(categroy, seaLevelIndex){
				console.debug('Marine Risk Explorer; main.js; updateMetrics()');
				//console.debug('sea level idx: ', seaLevelIndex);
				var roadBGValue = null, addyBGValue = null, roadTwnValue = null, addyTwnValue = null, valRaw = null, val = null, 
					highVal = 0, highValFieldName = null, svToolTipString = '', valWithSuffix = '';
				try{
					switch(categroy){
						case 'town':
							if(this.currentTown.data.hasOwnProperty('OBJECTID')){
								//console.debug('town has ObjectID - ok to continue');
								this.updateBlockGroupName("");
								//update the UI title
								//$('#town_name_label').html('Town of ' + this.currentTown.data[this.regionConfig.townsLayer_NameField]);

								//Social Vulnerability Ranking and Score Details - display all as %
								valRaw = this.currentTown.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100;
								val = parseFloat(Math.round(valRaw * 100) / 100).toFixed(0);
								$("#sv_slider").slider("value", val);
								$("#custom-handle").html(val + '%');
								valWithSuffix = this.ordinalSuffixOf(val);
								svToolTipString = "The town of "+this.currentTown.data[this.regionConfig.townsLayer_NameField]+" is in the " + valWithSuffix + " percentile and is more vulnerable than " + val + "% of other coastal Maine towns.";
								$("#svTooltip").attr("title",svToolTipString);

								//detail groups
								//clear any previous highest-value highlighting
								this.$el.find(".statGrid .statGridColumn ul li").removeClass('hilite');

								_.each(this.regionConfig.criticalFields.common.socioeconomic, lang.hitch(this,function(fieldName) {
									valRaw = this.currentTown.data[fieldName];
									if (typeof valRaw === 'number'){
										if(fieldName != "E_PCI"){
											val = this.currentTown.data[fieldName] * 100;
											if (val > highVal){
												highValFieldName = fieldName;
												highVal = val;
											}
											
											this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
										} else {
											this.$el.find("#metric_"+fieldName).html(this.addCommas(this.currentTown.data[fieldName]));
											this.$el.find("#metric_"+fieldName).parent().parent().addClass('pci');
										}
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.householdComp, lang.hitch(this,function(fieldName) {
									valRaw = this.currentTown.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentTown.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.minotiry, lang.hitch(this,function(fieldName) {
									valRaw = this.currentTown.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentTown.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.housing, lang.hitch(this,function(fieldName) {
									valRaw = this.currentTown.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentTown.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								
								//set sea level sensitive metrics
								switch(seaLevelIndex){
									case 0:
										//current sea level - clear the road and address values.
										roadTwnValue = "--";
										addyTwnValue = "--";
										break;
									case 1:
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.oneFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.oneFoot];
										break;
									case 2:
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.twoFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.twoFoot];
										break;
									case 3:
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.threeFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.threeFoot];
										break;
									case 4:
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.sixFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.sixFoot]
										break;
								}
								if(typeof roadTwnValue != 'number'){
									this.$el.find("#metric_costToRoad").html(roadTwnValue);
								}else{
									this.$el.find("#metric_costToRoad").html(this.addCommas(roadTwnValue));
								}
								//this.$el.find("#metric_costToRoad").html(this.addCommas(roadTwnValue));
								this.$el.find("#metric_numAddy").html(addyTwnValue);

								//TODO hide the smaller 'town totals' area, clear the values
								roadTwnValue = "--";
								addyTwnValue = "--";
								this.$el.find("#metric_costToRoad_twn").html(roadTwnValue);
								this.$el.find("#metric_numAddy_twn").html(addyTwnValue);
								$('.marine-risk .stats .stat .twinPanel .town').removeClass('active');

							}					
							break;
						case 'blockgroup':
							if(this.currentBlockGroup.data.hasOwnProperty('OBJECTID')){
								//console.debug('block group has ObjectID - ok to continue');
								this.updateBlockGroupName(this.currentBlockGroup.data[this.regionConfig.blockGroupLayer_NameField]);
								//update the UI title - town + blockgroup
								//$('#town_name_label').html('Town of ' + this.currentTown.data[this.regionConfig.townsLayer_NameField] + ' ' + this.currentBlockGroup.data[this.regionConfig.blockGroupLayer_NameField]);
								//$('#town_name_label').html(this.currentBlockGroup.data[this.regionConfig.blockGroupLayer_NameField]);

								//Social Vulnerability Ranking and Score Details - display all as %
								valRaw = this.currentBlockGroup.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100;
								val = parseFloat(Math.round(valRaw * 100) / 100).toFixed(0);
								$("#sv_slider").slider("value", val);
								$("#custom-handle").html(val + '%');
								valWithSuffix = this.ordinalSuffixOf(val);
								svToolTipString = "The town of "+this.currentBlockGroup.data[this.regionConfig.townsLayer_NameField]+" is in the " + valWithSuffix + " percentile and is more vulnerable than " + val + "% of other coastal Maine towns.";
								$("#svTooltip").attr("title",svToolTipString);

								//detail groups
								//clear any previous highest-value highlighting
								this.$el.find(".statGrid .statGridColumn ul li").removeClass('hilite');

								_.each(this.regionConfig.criticalFields.common.socioeconomic, lang.hitch(this,function(fieldName) {
									//this.$el.find("#metric_"+fieldName).html(this.currentBlockGroup.data[fieldName] * 100);
									valRaw = this.currentBlockGroup.data[fieldName];
									if (typeof valRaw === 'number'){
										if(fieldName != "E_PCI"){
											val = this.currentBlockGroup.data[fieldName] * 100;
											if (val > highVal){
												highValFieldName = fieldName;
												highVal = val;
											}
											
											this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
										}else{
											this.$el.find("#metric_"+fieldName).html(this.addCommas(this.currentBlockGroup.data[fieldName]));
											this.$el.find("#metric_"+fieldName).parent().parent().addClass('pci');
										}
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.householdComp, lang.hitch(this,function(fieldName) {
									valRaw = this.currentBlockGroup.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentBlockGroup.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.minotiry, lang.hitch(this,function(fieldName) {
									valRaw = this.currentBlockGroup.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentBlockGroup.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								highVal = 0;
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								highValFieldName = null;

								_.each(this.regionConfig.criticalFields.common.housing, lang.hitch(this,function(fieldName) {
									valRaw = this.currentBlockGroup.data[fieldName];
									if (typeof valRaw === 'number'){
										val = this.currentBlockGroup.data[fieldName] * 100;
										if (val > highVal){
											highValFieldName = fieldName;
											highVal = val;
										}
										
										this.$el.find("#metric_"+fieldName).html(parseFloat(Math.round(val * 100) / 100).toFixed(0));
									}else{
										this.$el.find("#metric_"+fieldName).html('--');
									}
								}));
								if(highValFieldName) this.$el.find("#metric_"+highValFieldName).parent().parent().addClass('hilite');
								
								//set sea level sensitive metrics
								switch(seaLevelIndex){
									case 0:
										//current sea level - clear the road and address values.
										roadBGValue = "--";
										addyBGValue = "--";
										roadTwnValue = "--";
										addyTwnValue = "--";
										break;
									case 1:
										roadBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.oneFoot];
										addyBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.oneFoot];
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.oneFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.oneFoot];
										break;
									case 2:
										roadBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.twoFoot];
										addyBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.twoFoot];
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.twoFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.twoFoot];
										break;
									case 3:
										roadBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.threeFoot];
										addyBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.threeFoot];
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.threeFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.threeFoot];
										break;
									case 4:
										roadBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.sixFoot];
										addyBGValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.sixFoot]
										roadTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.sixFoot];
										addyTwnValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.sixFoot]
										break;
								}
								if(typeof roadBGValue != 'number'){
									this.$el.find("#metric_costToRoad").html(roadBGValue);
								}else{
									this.$el.find("#metric_costToRoad").html(this.addCommas(roadBGValue));
								}
								this.$el.find("#metric_numAddy").html(addyBGValue);

								//show the town data also
								$('.marine-risk .stats .stat .twinPanel .town').addClass('active');
								if(typeof roadTwnValue != 'number'){
									this.$el.find("#metric_costToRoad_twn").html(roadTwnValue);
								}else{
									this.$el.find("#metric_costToRoad_twn").html(this.addCommas(roadTwnValue));
								}
								
								this.$el.find("#metric_numAddy_twn").html(addyTwnValue);
							}
							break;
						default:
							console.error('Error: invalid category.');
							return;
					}
				}catch (ex){
					console.error('Error; Marine Risk Explorer; main.js; updateMetrics()');
				}
			},
			/** 
			 * Method: prePrintModal
			 * 		
			 * Args:
			 * 		preModalDeferred {} - 
			 * 		$printArea {} -
			 * 		modalSandbox {} - 
			 * 		mapObject {} - 
			*/		
			prePrintModal: function (preModalDeferred, $printArea, modalSandbox, mapObject) {
				console.debug('Marine Risk Explorer; main.js; prePrintModal()');
				modalSandbox.append(_.template(print_setup, {}));
				$printArea.append(_.template(print_template)({
					printFooterTitle: this.regionConfig.printFooterTitle,
					printFooterBody: this.regionConfig.printFooterBody
				}));
				preModalDeferred.resolve();
			},
			/** 
			 * Method: postPrintModal
			 * 		
			 * Args:
			 * 		postModalDeferred {} - 
			 * 		modalSandbox {} - 
			 * 		mapObject {} - 
			*/		
			postPrintModal: function(postModalDeferred, modalSandbox, mapObject) {
				console.debug('Marine Risk Explorer; main.js; postPrintModal()');
				//set values in the 'print_template' as they were set in the 'print_setup' template.
				var title = $('#plugin-print-modal-content').find('#print-title').val();
				$("#print-title-map").html(title);				
				var subTitle = $('#plugin-print-modal-content').find('#print-subtitle').val();
				if(!subTitle){
					$('.title-sep').hide();
				} else if (subTitle.length === 0) {
					$('.title-sep').hide();
				} else {
					$("#print-subtitle-map").html(subTitle);
				}

				var roadTemplate = _.template(print_stat_template)({
					label: this.regionConfig.printInfo.items[0].label,
					item: this.regionConfig.printInfo.items[0].units + this.$el.find("#metric_costToRoad").html()
				});
				$("#print-cons-measures .stats").append(roadTemplate);

				var addyTemplate = _.template(print_stat_template)({
					label: this.regionConfig.printInfo.items[1].label,
					item: this.$el.find("#metric_numAddy").html()
				});
				$("#print-cons-measures .stats").append(addyTemplate);

				var svTemplate = _.template(print_stat_template)({
					label: this.regionConfig.printInfo.items[2].label,
					item: $("#custom-handle").html() //'%' included in the html from custom-handle
					
				});
				$("#print-cons-measures .stats").append(svTemplate);

				$('.legend-layer').addClass('show-extras');

				window.setTimeout(function() {
                    postModalDeferred.resolve();
                }, 100);
			},
			/** 
			 * Method: addCommas
			 * 		// http://stackoverflow.com/questions/2646385/add-a-thousands-separator-to-a-total-with-javascript-or-jquery
			 * Args:
			 * 		nStr {type: number or string} - 
			*/
			addCommas: function(nStr) {
			    nStr += '';
			    var x = nStr.split('.');
			    var x1 = x[0];
			    var x2 = x.length > 1 ? '.' + x[1] : '';
			    var rgx = /(\d+)(\d{3})/;
			    while (rgx.test(x1)) {
			        x1 = x1.replace(rgx, '$1' + ',' + '$2');
			    }
			    return x1 + x2;
			},
			/** 
			 * Method: ordinalSuffixOf
			 * 		https://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
			 * Args:
			 * 		i {type: } - 
			*/
			ordinalSuffixOf: function(i) {
				var j = i % 10,
					k = i % 100;
				if (j == 1 && k != 11) {
					return i + "st";
				}
				if (j == 2 && k != 12) {
					return i + "nd";
				}
				if (j == 3 && k != 13) {
					return i + "rd";
				}
				return i + "th";
			},
			/** 
			 * Method: methodStub
			 * 		
			 * Args:
			 * 		a {type: string} - 
			 * 		b {type: ojbect} - 
			*/		
			methodStub: function(a,b){
				console.debug('Marine Risk Explorer; main.js; methodStub()');
				try{

				}catch (ex){
					console.error('Error; Marine Risk Explorer; main.js; methodStub()');
				}
			}

		});

	}
);
