define([
	"dojo/_base/declare",
	"dojo/_base/lang",
	"framework/PluginBase",
	"esri/layers/VectorTileLayer",
	"esri/layers/ArcGISTiledMapServiceLayer",
	"esri/layers/ArcGISDynamicMapServiceLayer",
	"esri/layers/WMSLayer",
	"esri/layers/WMSLayerInfo",
	"esri/layers/FeatureLayer",
	"esri/layers/ImageParameters",
	"esri/geometry/Extent",
	"esri/SpatialReference",
	"esri/tasks/query",
	"esri/tasks/QueryTask",
	"esri/symbols/SimpleMarkerSymbol",
	"esri/symbols/SimpleFillSymbol",
	"esri/symbols/SimpleLineSymbol",
	"esri/Color",
	"esri/graphic",
    "dojo/dom",
    './State',
    'dojo/text!./region.json',
    'dojo/text!./print-setup.html',
    "dojo/text!./print_template.html",
    "dojo/text!./print_stat_template.html",
    "dojo/text!./template.html",
	], function(declare,
		lang,
		PluginBase,
		VectorTileLayer,
		ArcGISTiledMapServiceLayer,
		ArcGISDynamicMapServiceLayer,
		WMSLayer,
		WMSLayerInfo,
		FeatureLayer,
		ImageParameters,
		Extent,
		SpatialReference,
		Query,
		QueryTask,
		SimpleMarkerSymbol,
		SimpleFillSymbol,
		SimpleLineSymbol,
		Color,
		Graphic,
		dom,
		State,
		RegionConfig,
		print_setup,
		print_template,
		print_stat_template,
		template
	) {

		// TODO: Clear currently selected parcel button

		return declare(PluginBase, {
			toolbarName: 'Coastal Risk', //content pane title
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
			/** 
			 * Method: initialize
			 * 		The framework calls this during initial framework load from the file app\js\Plugin.js (approx line 70).
			 * Args:
			 * 		frameworkParameters {Object} - info about the external framework environment, including the app, map, legendContainer, and more
			*/
			initialize: function(frameworkParameters) {
				console.debug('Marine Risk Explorer; main.js; initialize()');

				declare.safeMixin(this, frameworkParameters);

				this.state = new State({}); //possible to pass a 'data' object in to the constructor, but not using here.
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
				this.region = this.state.getRegion(); //e.g. 'Maine'

				//hide the print button at the top of the plugin window
				$(this.printButton).hide();
				
				//Load town names. Populates a local array of town names.
				var townQuery = new Query();
                var townQueryTask = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.townsLayer_ServiceIndex);
                townQuery.where = '1=1';
                townQuery.returnGeometry = false;
                townQuery.outFields = ['*'];
				townQueryTask.execute(townQuery, _.bind(this.loadTownsSuccess, this),_.bind(this.loadTownsError, this));
				//townQueryTask.execute(townQuery, this.loadTownsSuccess, this.loadTownsError);
				

				// // Setup query handles
				// if (Number.isInteger(this.regionConfig.parcelsLayer)) {
				// 	this.qtParcels = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.parcelsLayer);
				// 	this.qParcels = new Query();
				// 	this.qParcels.returnGeometry = true;
				// 	this.qParcels.outFields = ['*'];
				// }
				
				// if (Number.isInteger(this.regionConfig.road_stream_crossing)) {
				// 	this.qtCrossings = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.road_stream_crossing);
				// 	this.qCrossings = new Query();
				// 	this.qCrossings.returnGeometry = true;
				// }



				// // Setup graphic styles
				
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
						new Color([60,252,252,1]), //color
						5 //width
					),
					new Color([255, 255, 255, 0]) //white, completely transparent
				);

				this.blockGroupSelectedSymbol = new SimpleFillSymbol(
					SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color([60,252,60,1]), //color
						5 //width
					),
					new Color([255, 255, 255, 0]) //white, completely transparent
				);
				// this.selectedBarrierSymbol = new SimpleMarkerSymbol(
				// 	SimpleMarkerSymbol.STYLE_CIRCLE,
				// 	17,
				//     new SimpleLineSymbol(
				// 		SimpleLineSymbol.STYLE_SOLID,
				// 		new Color([255, 235, 59, 1]),
				// 		3
				// 	),
				// 	new Color([225, 96, 82, 1])
				// );

				// this.highlightParcelSymbol = new SimpleFillSymbol(
				// 	SimpleFillSymbol.STYLE_SOLID,
				// 	new SimpleLineSymbol(
				// 		SimpleLineSymbol.STYLE_SOLID,
				// 		new Color([255,204,0,0.5]),
				// 		4
				// 	),
				// 	new Color([255, 255, 255, 0.0])
				// );
				// $(this.legendContainer).html('<div class="selected-barrier-lgnd" style="display: none;"><svg width="20" height="20"><circle fill="rgb(225, 96, 82)" stroke="rgb(255, 235, 59)" stroke-width="3" cx="10" cy="10" r="7"></circle></svg> <span style="position: relative; top:-5px;">Selected Barrier</span></div>');
				// this.initialized = true;
				// return this;
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
				//TODO eliminate need for self = this;
				var self = this;
				this.layers = {};
				// Only set the extent the first time the app is activated
				if(!this.activated){
					this.map.setExtent(this.defaultExtent);
				}

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
				//All layers
				if (this.regionConfig.service && !this.layers.coastalRisk) {
					this.layers.coastalRisk = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						id: 'coastalRisk'
					});
					
					this.layers.coastalRisk.setVisibleLayers(this.regionConfig.visibleLayerGroups.default);
					this.map.addLayer(this.layers.coastalRisk);
				}
				//Sea Level
				if (this.regionConfig.service && !this.layers.seaLevelRise) {
					this.layers.seaLevelRise = new ArcGISDynamicMapServiceLayer(this.regionConfig.service, {
						id: 'seaLevelRise'
					});
					this.layers.seaLevelRise.setVisibleLayers([this.regionConfig.scenarios[0].layer]);
					this.map.addLayer(this.layers.seaLevelRise);
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

				// Set marsh scenario.  Will default to 0 unless a share link was used to initalize different values
				this.setMarshScenario(this.slrIdx);
				this.$el.find("#salt-marsh-slider").slider("value", this.slrIdx);

				this.activated = true;
				this.render();
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
					//towns: Object.keys(this.townNames).sort(),
					towns: this.townNames,
					region: this.region,
					//stats: this.regionConfig.stats,
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
									console.debug('query task success:', featSet);
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
						handle.text( ui.value );
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

				//map and layer events
				// var townsOnMouseOver = this.layers.towns.on('mouse-over', lang.hitch(this,function(evt) {
				// 	console.debug("towns mouse-over!");
				// 	if (this.layers.townGraphics.graphics.length === 0){
				// 		var highlightGraphic = new Graphic(evt.graphic.geometry, this.townSymbol, evt.graphic.attributes);
				// 		this.layers.townGraphics.add(highlightGraphic);
				// 	}
				// }));
				// var townsOnMouseOut = this.layers.towns.on('mouse-out', lang.hitch(this, function(evt) {
				// 	console.debug("towns mouse-out!");
				// 	if (this.layers.townGraphics.graphics.length >= 1){
				// 		this.layers.townGraphics.clear();
				// 	}
				// }));
				// var blockGroupsOnClick = this.layers.blockGroups.on('click', lang.hitch(this,function(evt) {
				// 	console.debug("block group feature click!");
				// 	this.zoomToBlockGroup(evt.graphic);
				// }));

				this.marineRiskMapClickEvent = this.map.on('click', lang.hitch(this, function(evt) { 
					console.debug("map click!");
					var qt = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.blockGroupLayer_ServiceIndex);
					var q = new Query();
					//q.where = this.regionConfig.blockGroupLayer_NameField + " = '" + townName + "'";
					q.geometry = evt.mapPoint;
					q.outFields = ['*'];
					q.returnGeometry = true;
					qt.execute(q, lang.hitch(this,function(featSet){
						console.debug('BG query task success:', featSet);
						if (featSet.features.length >= 1){
							this.setCurrentBlockGroup(featSet.features[0]);
							this.zoomToBlockGroup(featSet.features[0]);
							this.updateMetrics('blockgroup',self.$el.find("#salt-marsh-slider").slider("value"));
							this.updateBlockGroupName(featSet.features[0].attributes[this.regionConfig.blockGroupLayer_NameField]);
						} else {
							//TODO show data for the town then?
							//TODO this can also occurr (other than clicking in no-mans-land) when clicking on a town with no block groups, 
							//	like in 'Marion Twp' or 'Whiting' (the grey ones on the map)
						}
					}), lang.hitch(this,function(err){
						console.error('BG query task error:',err);
					}));

					//Check: is BG still in the currently selected town? If not, change town selection in map and in DDL, but do not fire on-change for the DDL.
					//TODO - this action raises the question of how the user can cange the metrics view back to town after picking a BG?
					var qtTown = new QueryTask(this.regionConfig.service + '/' + this.regionConfig.townsLayer_ServiceIndex);
					var qTown = new Query();
					qTown.geometry = evt.mapPoint;
					qTown.outFields = ['*'];
					qTown.returnGeometry = true;
					qtTown.execute(qTown, lang.hitch(this,function(featSet){
						console.debug('Town query task success:', featSet);
						if (featSet.features.length >= 1){
							if(featSet.features[0].attributes[this.regionConfig.townsLayer_NameField] != this.currentTown.name){
								console.debug('town names do not match, change selected town');
								this.clearSelectedTownGraphics();
								this.drawSelectedTownGraphics(featSet.features[0]);
								this.setCurrentTown(featSet.features[0]);
								//Update the town ddl to the new town.
								this.$el.find('.custom-combobox-input').val(featSet.features[0].attributes[this.regionConfig.townsLayer_NameField]);
							}else {
								console.debug('town names match');
							}
						} else {
							//TODO msg to user - no block group found
						}
					}), lang.hitch(this,function(err){
						console.error('Town query task error:',err);
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

				this.$el.find('.carrotToggle').on('click',function(a,b,c){
					$('.stats .stat .statGrid').toggleClass('hidden');
				});

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

				this.$el.find('.export .print').on('click', function() {
					self.$el.parent('.sidebar').find('.plugin-print').trigger('click');
				});

				this.$el.find('.export .notes').on('click', function() {
					TINY.box.show({
				        animate: true,
				        url: 'plugins/future-habitat-v2/notes.html',
				        fixed: true,
				        width: 560,
				        height: 700
				    });
				});
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

				// TODO: Cleanup map click events
				this.marineRiskMapClickEvent.remove();
				
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
			 * 		Note: No need to pass current map extents out as the framework appears to be handle that.
			 * Args:
			 * 		
			*/
			getState: function(data) {
				console.debug('marine_risk_explorer; main.js; getState()');
				console.debug('data = ', data);
                // return {
                // 	slrIdx: this.state.getSLRIdx(),
                //     region: this.state.getRegion()
                // };
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
				console.debug('Marine Risk Explorer; main.js; setState()');
				// this.state = new State(data);
				// this.region = data.region;
				// this.slrIdx = data.slrIdx;
				// this.$el.find('#chosenRegion').val(data.region).trigger("chosen:updated");
			},
			
            /** 
			 * Method: loadTownsSuccess
			 * 		
			 * Args:
			 * 		qeuryResults {object} - an object of features as returned by arcgis server's query task
			*/
			loadTownsSuccess:function(queryResults){
				console.debug('Marine Risk Explorer; main.js; loadTownsSuccess()');
				//console.debug(queryResults);
				this.townNames = [];
				$.each(queryResults.features, _.bind(function(idx, feat){
					this.townNames.push(feat.attributes[this.regionConfig.townsLayer_NameField]);
				},this));
				// console.debug(this.townNames);
				// _.each(this.townNames, function(val, idx) { 
				// 	console.debug(val);
				// });
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
				console.debug('Marine Risk Explorer; main.js; setMarshScenario() idx=', idx);
				this.idx = idx;
				this.state = this.state.setSLRIdx(idx);
				this.$el.find('.salt-marsh-control').attr('data-scenario-idx', idx); //sets the slider index?
				var layerIds = this.regionConfig.scenarios.map(function(scenario) {
					return scenario.layer;
				});
				if (this.regionConfig.scenariosAdditive) {
					this.layers.seaLevelRise.setVisibleLayers(layerIds.slice(0, idx + 1));
				} else {
					this.layers.seaLevelRise.setVisibleLayers([layerIds[idx]]);
				}
				this.layers.seaLevelRise.refresh();
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
				this.layers.coastalRisk.setVisibleLayers(lyrAry);
				this.layers.coastalRisk.refresh();
				//update data - if currentBlockGroup.data has an objedtid property, assume we are looking at a blockgroup, otherwise town
				if(this.currentBlockGroup.data.hasOwnProperty("OBJECTID")){
					this.updateMetrics('blockgroup', idx);
				}else{
					this.updateMetrics('town', idx);
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
				console.debug('Marine Risk Explorer; main.js; updateMetrics() for ' + categroy);
				var roadValue = null;
				var addyValue = null;
				try{
					switch(categroy){
						case 'town':
							if(this.currentTown.data.hasOwnProperty('OBJECTID')){
								console.debug('town has ObjectID - ok to continue');
								this.updateBlockGroupName("");
								//update the UI title
								$('#town_name_label').html('Town of ' + this.currentTown.data[this.regionConfig.townsLayer_NameField]);

								//Social Vulnerability Ranking and Score Details - display all as %
								console.debug('settting SV slider bar with val - ', this.currentTown.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank])
								$("#sv_slider").slider("value", this.currentTown.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100);
								$("#custom-handle").html(this.currentTown.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100);
								//detail groups
								_.each(this.regionConfig.criticalFields.common.socioeconomic, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentTown.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.householdComp, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentTown.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.minotiry, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentTown.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.housing, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentTown.data[fieldName] * 100);
								}));

								//set sea level sensitive metrics
								switch(seaLevelIndex){
									case 0:
										//current sea level - clear the road and address values.
										roadValue = "";
										addyValue = "";
										break;
									case 1:
										roadValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.oneFoot];
										addyValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.oneFoot];
										break;
									case 2:
										roadValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.twoFoot];
										addyValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.twoFoot];
										break;
									case 3:
										roadValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.threeFoot];
										addyValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.threeFoot];
										break;
									case 4:
										roadValue = this.currentTown.data[this.regionConfig.criticalFields.towns.costToRoad.sixFoot];
										addyValue = this.currentTown.data[this.regionConfig.criticalFields.towns.numAddressesInaccessible.sixFoot]
										break;
								}
								this.$el.find("#metric_costToRoad").html(roadValue);
								this.$el.find("#metric_numAddy").html(addyValue);
							}					
							break;
						case 'blockgroup':
							if(this.currentBlockGroup.data.hasOwnProperty('OBJECTID')){
								console.debug('block group has ObjectID - ok to continue');
								this.updateBlockGroupName(this.currentBlockGroup.data[this.regionConfig.blockGroupLayer_NameField]);
								//update the UI title - town + blockgroup
								$('#town_name_label').html('Town of ' + this.currentTown.data[this.regionConfig.townsLayer_NameField] + ' ' + this.currentBlockGroup.data[this.regionConfig.blockGroupLayer_NameField]);

								//Social Vulnerability Ranking and Score Details - display all as %
								console.debug('settting SV slider bar with val - ', this.currentBlockGroup.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank])
								$("#sv_slider").slider("value", this.currentBlockGroup.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100);
								$("#custom-handle").html(this.currentBlockGroup.data[this.regionConfig.criticalFields.common.socialVulnerabilityRank] * 100);
								//detail groups
								_.each(this.regionConfig.criticalFields.common.socioeconomic, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentBlockGroup.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.householdComp, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentBlockGroup.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.minotiry, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentBlockGroup.data[fieldName] * 100);
								}));
								_.each(this.regionConfig.criticalFields.common.housing, lang.hitch(this,function(fieldName) {
									this.$el.find("#metric_"+fieldName).html(this.currentBlockGroup.data[fieldName] * 100);
								}));

								//set sea level sensitive metrics
								switch(seaLevelIndex){
									case 0:
										//current sea level - clear the road and address values.
										roadValue = "";
										addyValue = "";
										break;
									case 1:
										roadValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.oneFoot];
										addyValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.oneFoot];
										break;
									case 2:
										roadValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.twoFoot];
										addyValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.twoFoot];
										break;
									case 3:
										roadValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.threeFoot];
										addyValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.threeFoot];
										break;
									case 4:
										roadValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.costToRoad.sixFoot];
										addyValue = this.currentBlockGroup.data[this.regionConfig.criticalFields.blockGroups.numAddressesInaccessible.sixFoot]
										break;
								}
								this.$el.find("#metric_costToRoad").html(roadValue);
								this.$el.find("#metric_numAddy").html(addyValue);
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
			prePrintModal: function (preModalDeferred, $printArea, modalSandbox, mapObject) {
				modalSandbox.append(_.template(print_setup, {}));
				$printArea.append(_.template(print_template)({
					printFooterTitle: this.regionConfig.printFooterTitle,
					printFooterBody: this.regionConfig.printFooterBody
				}));
				preModalDeferred.resolve();
			},
			postPrintModal: function(postModalDeferred, modalSandbox, mapObject) {
				$("body").attr('data-con-measures', $('#print-cons').is(':checked'));
				$("#print-title-map").html(modalSandbox.find("#print-title").val());
				$("#print-subtitle-map").html(modalSandbox.find("#print-subtitle").val());
				if ($("#print-subtitle").val().length === 0) {
					$('.title-sep').hide();
				}

				_.each(this.regionConfig.stats, function(stat) {
					var icon = stat.icon;
					var label = stat.label;
					var units = stat.units;
					var acres = stat.acres;
					var statLabel = label.toLowerCase().replace(/ /g, '-').replace(/\//g, '-');
					var statValue = $('[data-stat=' + statLabel + '] .value').html();
					var template = _.template(print_stat_template)({
						icon: icon,
						label: label,
						units: units,
						acres: acres,
						stat: statValue
					});
					$("#print-cons-measures .stats").append(template);

				});

				$('.legend-layer').addClass('show-extras');

				window.setTimeout(function() {
                    postModalDeferred.resolve();
                }, 100);
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
