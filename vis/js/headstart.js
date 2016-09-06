// Headstart
// filename: headstart.js
import StateMachine from 'javascript-state-machine';
import d3 from 'd3';

import { mediator } from 'mediator';
import { BubblesFSM } from 'bubbles';
import { papers } from 'papers';
import { list } from 'list';

import { intro, intro_cn3, intro_plos } from 'intro';
import { getRealHeight, initVar } from "helpers";
import { BrowserDetect, h } from "helpers";

const timelineTemplate = require('templates/timeline.handlebars')

export var HeadstartFSM = function(host, path, tag, files, options) {
  // a container for variables
  this.VERSION = 2.5;

  this.host = host;
  this.path = path;
  this.tag = tag;
  this.viz = $("#" + tag);

  // map
  this.min_height = 600;
  this.min_width  = 600;
  this.max_height = 1000;
  this.timeline_size = 600;
  this.bubble_min_scale = initVar(options.bubble_min_scale, 1);
  this.bubble_max_scale = initVar(options.bubble_max_scale, 1);
  this.paper_min_scale = initVar(options.paper_min_scale, 1);
  this.paper_max_scale = initVar(options.paper_max_scale, 1);
  this.zoom_factor = 0.9;

  // map reference sizes
  this.reference_size = 650;
  this.max_diameter_size = 50;
  this.min_diameter_size = 30;
  this.max_area_size = 110;
  this.min_area_size = 50;

  this.is_force_areas = initVar(options.is_force_areas, false);
  this.area_force_alpha = initVar(options.area_force_alpha, 0.02);

  // bubbles
  this.area_title_max_size = 50;

  // papers
  this.dogear_width  = 0.1;
  this.dogear_height = 0.1;
  this.paper_width_factor  = 1.2;
  this.paper_height_factor = 1.6;

  // list
  this.min_list_size = 400;
  this.max_list_size = 500;
  this.list_height = 51;
  this.list_height_correction = 29;

  this.sort_options = initVar(options.sort_options, [
      "readers",
      "title",
      "authors",
      "year"
  ])

  this.content_based = initVar(options.is_content_based, false);
  if (this.content_based) {
      this.sort_options = ["title", "area"];
  }

  // preview
  this.preview_image_width_list  = 230;
  this.preview_image_height_list = 300;
  this.preview_page_height = 400;
  this.preview_top_height  = 30;
  this.preview_image_width  = 738;
  this.preview_image_height = 984;
  this.abstract_small = 250;
  this.abstract_large = null;

  // transition
  this.transition_duration = 750;
  this.zoomout_transition = 750;

  // misc
  this.debounce = 200;

  // var inits
  this.current_zoom_node = null;
  this.current_enlarged_paper = null;
  this.current_file_number = 1;
  this.current_circle = null;
  this.papers_list = null;
  this.circle_zoom = 0;
  this.is_zoomed = false;
  this.zoom_finished = false;

  // show
  this.show_timeline = initVar(options.show_timeline, true);
  this.show_dropdown = initVar(options.show_dropdown, true);
  this.show_intro = initVar(options.show_intro, false);
  this.show_infolink = initVar(options.show_infolink, true);
  this.show_titlerow = initVar(options.show_titlerow, true);
  this.show_list = initVar(options.show_list, false);

  // behaviour settings (mostly legacy)
  this.is_evaluation = initVar(options.is_evaluation, false);
  this.evaluation_service = options.evaluation_service;
  this.is_adaptive = initVar(options.is_adaptive, false);
  this.conference_id = initVar(options.conference_id, 0);
  this.user_id = initVar(options.user_id, 0);
  this.max_recommendations = initVar(options.max_recommendations, 10);
  this.files = files;

  // paths
  this.images_path = initVar(options.images_path, "../vis/images/");
  this.preview_type = initVar(options.preview_type, "images");

  // data specific settings
  this.subdiscipline_title = initVar(options.title, "");
  this.use_area_uri = initVar(options.use_area_uri, false);
  this.url_prefix = initVar(options.url_prefix, null)
  this.input_format = initVar(options.input_format, "csv");
  this.base_unit = initVar(options.base_unit, "readers")

  // application specific variables
  this.language = initVar(options.language, "eng");
  this.localization = {
      eng: {
          loading: "Loading...",
          search_placeholder: "Search...",
          show_list: "Show list",
          hide_list: "Hide list",
          intro_label:"What's this?",
          readers: "readers",
          year: "date",
          authors: "authors",
          title: "title",
          area: "Area"
      },
      ger: {
          loading: "Wird geladen...",
          search_placeholder: "Suche...",
          show_list: "Liste ausklappen",
          hide_list: "Liste einklappen",
          intro_label :"Was ist das?",
          readers: "Leser",
          year: "Jahr",
          authors: "Autor",
          title: "Titel",
          area: "Bereich"
      },
      eng_plos: {
          loading: "Loading...",
          search_placeholder: "Search...",
          show_list: "Show list",
          hide_list: "Hide list",
          intro_label :"What's this?",
          readers: "views",
          year: "date",
          authors: "authors",
          title: "title",
          area: "Area"
      }
  }

  //plos
  this.url_plos_pdf = "http://www.plosone.org/article/fetchObject.action?representation=PDF&uri=info:doi/";
  this.plos_journals_to_shortcodes = {
      "plos neglected tropical diseases": "plosntds",
      "plos one": "plosone",
      "plos biology": "plosbiology",
      "plos medicine": "plosmedicine",
      "plos computational Biology": "ploscompbiol",
      "plos genetics": "plosgenetics",
      "plos pathogens": "plospathogens",
      "plos clinical trials": "plosclinicaltrials"
  }

  // contains bubbles objects for the timline view
  // elements get added to bubbles by calling registerBubbles()
  this.bubbles = {}

  if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
      return this.slice(0, str.length) == str;
    };
  }

  if (typeof String.prototype.escapeSpecialChars != 'function') {
    String.prototype.escapeSpecialChars = function() {
      return this.replace(/[\\]/g, '\\\\')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t')
        .replace(/[\"]/g, '\\"')
        .replace(/\\'/g, "\\'");
       };
     }

}; // end HeadstartFSM constructor

HeadstartFSM.prototype = {

  // prototype methods
  checkBrowserVersions: function() {
    var browser = BrowserDetect.browser;

    if (browser != "Firefox" && browser != "Safari" && browser != "Chrome") {
            alert("You are using an unsupported browser. This visualization"
                    + " was successfully tested with the latest versions of Chrome, Safari, Opera and Firefox.");
    }
  },

  // simple check that all required libraries are present at the moment:
  // - d3
  // - jQuery
  // - Javascript-State-Machine
  // are needed for headstart.
  checkThatRequiredLibsArePresent: function() {
    if (typeof(d3) == "undefined"){
      alert("d3 v3 is required for headstart");
      console.log("d3 is required!");
    }

    if (typeof(window.jQuery) == "undefined"){
      alert("jquery is required for headstart");
      console.log("jquery is required!");
    }

    if (typeof(StateMachine) == "undefined"){
      alert("state machine is required for headstart");
      console.log("state machine is required for headstart");
    }
  },

  recordAction: function(id, action, user, type, timestamp, additional_params, post_data) {

    if(!this.is_evaluation)
      return;

    timestamp = (typeof timestamp !== 'undefined') ? (escape(timestamp)) : ("")
    additional_params = (typeof additional_params !== 'undefined') ? ('&' + additional_params) : ("")
    if(typeof post_data !== 'undefined') {
      post_data = {post_data:post_data};
    } else {
      post_data = {};
    }

    let php_script = require("services/writeActionToLog.php")

    $.ajax({
      url: php_script + '?user=' + user
              + '&action=' + action
              + '&item=' + escape(id)
              + '&type=' + type
              + '&item_timestamp=' + timestamp
              + additional_params
              + '&jsoncallback=?',
      type: "POST",
      data: post_data,
      dataType: "json",
      success: function(output) {
        console.log(output)
      }
    });
  },

  resetBubbles: function () {
    if(this.bubbles) {
      delete this.bubbles;
      this.bubbles = {};
    }

    $.each(this.files, (index, elem) => {
      var bubble = new BubblesFSM();
      this.registerBubbles(bubble);
      bubble.title = elem.title;
      bubble.file = elem.file;
    })
  },

  calcChartSize: function() {
      var parent_height = getRealHeight($("#" + this.tag));
      var subtitle_heigth = $("#subdiscipline_title").outerHeight(true);

      if (parent_height == 0) {
          this.available_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - subtitle_heigth;
      } else {
          this.available_height = $("#" + this.tag).height() - subtitle_heigth;
      }

      this.available_height = this.available_height - 1;

      if (this.is("timeline")) {
          var timeline_height = $(".tl-title").outerHeight(true);
          this.available_height =  this.available_height - timeline_height;
          this.available_width = $("#" + this.tag).width()
      } else {
          this.available_width = $("#" + this.tag).width() - $("#list_explorer").width(); 
      }

      if (this.availableSizeIsBiggerThanMinSize()) {
          if (this.available_width >= this.available_height) {
              this.current_vis_size = this.available_height;
          } else {
              this.current_vis_size = this.available_width;
          }
      } else {
          this.current_vis_size = this.getMinSize();
      }

      if (this.current_vis_size > this.max_height) {
          this.current_vis_size = this.max_height;
      }
  },


  // Calculate all scales for the current map
  initScales: function() {
      // Init all scales
      this.chart_x = d3.scale.linear();
      this.chart_y = d3.scale.linear();

      this.chart_x_circle = d3.scale.linear();
      this.chart_y_circle = d3.scale.linear();

      this.x = d3.scale.linear();
      this.y = d3.scale.linear();
      
      this.paper_x = d3.scale.linear();
      this.paper_y = d3.scale.linear();

      this.circle_size = d3.scale.sqrt()
      this.diameter_size = d3.scale.sqrt()
  },

  setScaleRanges: function() {
      // Calculate correct scaling factors and paper/circle dimensions
      this.correction_factor = this.current_vis_size / this.reference_size;

      this.circle_min = (this.min_area_size * this.correction_factor) * this.bubble_min_scale;
      this.circle_max = (this.max_area_size * this.correction_factor) * this.bubble_max_scale;
      this.circle_size.range([this.circle_min, this.circle_max]);

      this.paper_min = (this.min_diameter_size * this.correction_factor) * this.paper_min_scale;
      this.paper_max = (this.max_diameter_size * this.correction_factor) * this.paper_max_scale;
      this.diameter_size.range([this.paper_min, this.paper_max]);

      // Set ranges on scales
      var padding_articles = this.paper_max;
      this.chart_x.range([padding_articles, this.current_vis_size - padding_articles]);
      this.chart_y.range([padding_articles, this.current_vis_size - padding_articles]);

      var circle_padding = 0;
      this.chart_x_circle.range([circle_padding, this.current_vis_size - circle_padding]);
      this.chart_y_circle.range([circle_padding, this.current_vis_size - circle_padding]);

      var zoomed_article_padding = 60;
      this.x.range([zoomed_article_padding, this.current_vis_size - zoomed_article_padding]);
      this.y.range([zoomed_article_padding, this.current_vis_size - zoomed_article_padding]);
      
      var zoomed_article_padding_paper = 35;
      this.paper_x.range([zoomed_article_padding_paper, this.current_vis_size - zoomed_article_padding_paper]);
      this.paper_y.range([zoomed_article_padding_paper, this.current_vis_size - zoomed_article_padding_paper]);
  },

  // Size helper functions
  getMinSize: function() {
      if (this.min_height >= this.min_width)
          return this.min_width;
      else
          return this.min_height;
  },

  availableSizeIsBiggerThanMinSize: function() {
    if ( this.available_width > this.min_width && this.available_height > this.min_height )
      return true;
    else
      return false;
  },

  // auto if enough space is available, else hidden
  setOverflowToHiddenOrAuto: function( selector ) {
    var overflow = "hidden";

    if ( this.current_vis_size > this.available_height ||
         this.current_vis_size + this.list_width > this.available_width ){
        overflow = "auto";
    }

    d3.select( selector ).style( "overflow" , overflow );
  },

  // Draw basic SVG canvas
  // NOTE attribute width addition by number of elements
  drawSvg: function(update) {
      
      update = typeof update !== 'undefined' ? update : false;
      
      this.svg = d3.select("#chart-svg");

      if (this.is("timeline")) {
          s = this.current_vis_size * Object.keys(this.bubbles).length;
          this.svg.attr("width", s)
                  .attr("height", this.current_vis_size);
          if (update === false) {
            this.svg.attr("viewBox", "0 0 " + s + " " + this.current_vis_size)
          }
      } else {
          this.svg.attr("height", this.current_vis_size + "px")
              .attr("width", "100%")
              .attr("preserveAspectRatio", "xMidYMid meet");
          if (update === false) {
            this.svg.attr("viewBox", "0 0 " + this.current_vis_size + " " + this.current_vis_size);
          }
      }
  },

  drawChartCanvas: function() {

    this.chart = this.svg.append("g").attr( "id", "chart_canvas" );
    // Rectangle to contain nodes in force layout
    let rect = this.chart.append("rect")
    // var rect_width = this.current_vis_size;// + this.max_list_size;
    rect.attr( "height", this.current_vis_size + "px" )
    rect.attr( "width",  this.current_vis_size + "px" );

    // chart.attr( "height", this.current_vis_size + "px" )
    // chart.attr( "width",  this.current_vis_size + "px" );
  },

  initEventListeners: function() {
      d3.select(window).on("resize", () => {
          this.calcChartSize();
          this.drawSvg(true);
          list.fit_list_height();
      });

      // Info Modal Event Listener
      $('#info_modal').on('show.bs.modal', function(event) {
          // var source = $(event.relatedTarget) // Button that triggered the modal
          // var type = source.data('type') // Extract info from data-* attributes
          // var modal = $()  
          $(this).find('.modal-title ').text(intro.title);
          $(this).find('.modal-body').html(intro.body);
      })
  },


  // Mouse interaction listeners
  initMouseListeners: function() {
    this.initMouseMoveListeners();
    this.initMouseClickListeners();
    this.initClickListenersForNav();
  },

  initMouseMoveListeners: function() {
    $("rect").on( "mouseover", () => {
      if (!this.is_zoomed) {
        this.bubbles[this.current_file_number].onmouseout("notzoomedmouseout");
        this.current_circle = null;
      }
      this.bubbles[this.current_file_number].mouseout("outofbigbubble");
      this.initClickListenersForNav();
    });
  },

  initMouseClickListeners: function() {
      $("#chart-svg").on("click", () => {
          this.bubbles[this.current_file_number].zoomout();
      });

      $("#" + this.tag).bind('click', (event) => {
          if (event.target.id === this.tag) {
              this.bubbles[this.current_file_number].zoomout();
          }
      });
  },


  initClickListenersForNav: function() {
      $("#timelineview").on("click", () => {
          if ($("#timelineview a").html() == "TimeLineView") {
              mediator.publish("to_timeline", this);
          }
      });
  },


  // Draws the header for this
  drawTitle: function() {
    let chart_title = "";
    
    if(this.subdiscipline_title === "") {
        if (this.language == "eng") {
            chart_title = 'Overview of <span id="num_articles"></span> articles';
        } else {
            chart_title = 'Überblick über <span id="num_articles"></span> Artikel';
        }
    } else {
        chart_title = this.subdiscipline_title;
    }

    $("#subdiscipline_title h4").html(chart_title);
    $("#num_articles").html($(".paper").length);

    if (this.show_infolink) {
        let infolink = ' (<a data-toggle="modal" data-type="text" href="#info_modal" id="infolink"></a>)'
        $("#subdiscipline_title h4").append(infolink);
        $("#infolink").text(this.localization[this.language].intro_label);
    }

    if (this.show_timeline) {
        let link = ' <span id="timelineview"><a href="#">TimeLineView</a></span>';
        $("#subdiscipline_title>h4").append(link);
    }

    if (this.show_dropdown) {
        let dropdown = '<select id="datasets"></select>';

        $("#subdiscipline_title>h4").append(" Select dataset: ");
        $("#subdiscipline_title>h4").append(dropdown);

        $.each(this.bubbles, (index, entry) => {
            let current_item = '<option value="' + entry.file + '">' + entry.title + '</option>';
            $("#datasets").append(current_item);
        })

        //$("#datasets " + headstart.current_file_number + ":selected").text();
        $("#datasets").val(this.bubbles[this.current_file_number].file);

        $("#datasets").change(() => {
            let selected_file_number = datasets.selectedIndex + 1;
            if (selected_file_number != this.current_file_number) {
                this.tofile(selected_file_number);
            }
        })
    }
},


  initForceAreas: function() {
    let padded = this.current_vis_size - this.padding;
    this.force_areas = d3.layout.force().links([]).size([padded, padded]);
  },

  initForcePapers: function() {
    let padded = this.current_vis_size - this.padding;
    this.force_papers = d3.layout.force().nodes([]).links([]).size([padded, padded]);
    if (typeof checkPapers !== 'undefined') {
        window.clearInterval(checkPapers);
    }
  },

  // calls itself over and over until the forced layout of the papers
  // is established
  checkForcePapers: function() {
    var bubble = this.bubbles[this.current_file_number];

    if (this.is("normal") || this.is("switchfiles")) {
      var checkPapers = window.setInterval(() => {
        if (this.is("normal") || this.is("switchfiles")) {
          if ((!papers.is("ready") && !papers.is("none")) || (bubble.is("startup") || bubble.is("none") || (bubble.is("start")) )) {
            if (this.force_papers.alpha() <= 0 && this.force_areas.alpha() <= 0) {
              papers.forced();
              if(this.show_list) {
                list.show();
              }
              window.clearInterval(checkPapers);
            }
          }
        }
      }, 10);
    }
  },

  // for the timelineview new bubbles are registered with headstart and kept
  // in headstart.bubbles = {} object
  registerBubbles: function( new_bubbles ) {
    if (new_bubbles.id == "0") {
      new_bubbles.id = this.bubblesSize() + 1; // start id with 1
    }

    // add bubbles if not registered already
    if ( !(new_bubbles.id in this.bubbles) ) {
      this.bubbles[new_bubbles.id] = new_bubbles;
    } else {
      return false;
    }

    return true;
  },

  bubblesSize: function() {
    var size = 0, key;
    for (key in this.bubbles) {
      if (this.bubbles.hasOwnProperty(key));
      size++;
    }
    return size;
  },

  // Grid drawing methods
  // draw x and y lines in svg canvas for timelineview
  drawGrid: function() {
    this.drawXGrid();
    this.drawYGrid();
  },

  removeGrid: function() {
    $("line").remove();
  },

  drawYGrid: function() {
    var to = (this.bubblesSize() * this.current_vis_size);
    for (var i = 0; i <= to; i+= this.current_vis_size) {
      this.svg.append("line")
      .attr("x1", i)
      .attr("x2", i)
      .attr("y1", "0")
      .attr("y2", "900")
    }
  },

  drawXGrid: function() {
    for (var i = 0; i <= 900; i+=50) {
      this.svg.append("line")
      .attr("x1", "0")
      .attr("x2", this.bubblesSize() * this.current_vis_size)
      .attr("y1", i)
      .attr("y2", i)
    };
  },

  drawGridTitles: function(update) {
      
      update = typeof update !== 'undefined' ? update : false;
      
      if (update === true) {
          $("#tl-titles").width(this.current_vis_size * Object.keys(this.bubbles).length);
          $(".tl-title").css("width", this.current_vis_size);
      } else {
          for (var i = 1; i <= this.bubblesSize(); i++) {
              $("#tl-titles").append(
                  '<div class="tl-title"><h3>' + this.bubbles[i].title + '</h3></div>');
          }
          $("#tl-titles").width(this.current_vis_size * Object.keys(this.bubbles).length);
          $(".tl-title").css("width", this.current_vis_size)
      }
  },

  createRestUrl: function () {
      let url = require("services/getBookmarks.php") + "?user=" + this.user_id;

      //sometimes the conference id array is not recognized
      let conference_id = eval(this.conference_id);

      if($.isArray(conference_id)) {
          conference_id.forEach((val) => {
            url += "&conference[]=" + val;
          })
      } else {
          url += "&conference=" + this.conference_id;
      }

      url += "&max_recommendations=" + this.max_recommendations;

      url += "&jsoncallback=?";

      return url;
  },

  // FSM callbacks
  // the start event transitions headstart from "none" to "normal" view
  onstart: function(event, from, to, file) {
      this.calcChartSize();

      this.initScales();

      this.checkBrowserVersions();
      this.checkThatRequiredLibsArePresent();

      this.setOverflowToHiddenOrAuto("#main");
      this.resetBubbles();

      var bubbles = this.bubbles[this.current_file_number];

      // NOTE: async call
      // therefore we need to call the methods which depend on bubbles.data
      // after the csv has been received.
      var setupVisualization = (csv) => {
          this.drawTitle();

          this.calcChartSize();
          this.setScaleRanges();

          this.drawSvg();
          this.drawChartCanvas();
          if (this.is_adaptive) {

              var url = this.createRestUrl();

              $.getJSON(url, (data) => {
                  this.startVisualization(this, bubbles, csv, data, true);
              });
          } else {
              this.startVisualization(this, bubbles, csv, null, true);
          }

          // Horrible solution but the first call is needed to calculate the chart height
          // and this call sets the final number of articles in the viz
          this.drawTitle();
      }

      

      switch (this.input_format) {
          case "csv":
              let filename = bubbles.file.split("/")[2]
              let data = require("../data/" + filename)
              d3.csv(data, setupVisualization);
              break;

          case "json":
              let php_script = require('services/getLatestRevision.php');
              d3.json(php_script + "?vis_id=" + bubbles.file, setupVisualization);
              break;

          case "json-direct":
              setupVisualization(bubbles.file);

              break;

          default:
              break;
      }
  },


  // 'ontotimeline' transitions from Headstarts "normal" view to the timeline
  // view. In a nutshell:
  // 1. it requires some cleanup
  //    - objects which are no longer needed
  //    - the canvas
  // 2. rendering of new elements, on a bigger
  //    chart
  ontotimeline: function(event, from, to) {
      if (typeof checkPapers !== 'undefined') {
        window.clearInterval(checkPapers);
      }

      this.force_areas.stop();
      this.force_papers.stop();

      this.resetBubbles();

      // clear the canvas
      $("#chart_canvas").empty();

      // clear the list list
      $("#list_explorer").empty();

      this.bubbles[this.current_file_number].current = "x";
      papers.current = "none";
      list.current = "none";

      // change heading to give an option to get back to normal view
      this.viz.empty()

      let timeline = timelineTemplate();
      this.viz.append(timeline);

      this.drawTitle()
      this.drawGridTitles();

      this.drawNormalViewLink();
      this.initScales();

      this.calcChartSize();
      this.setScaleRanges();
      this.drawSvg();
      this.drawChartCanvas()
      
      this.drawGridTitles(true);


      d3.select("#headstart-chart").attr("overflow-x", "scroll");

      $("#main").css("overflow", "auto");

      // load bubbles in sync

      $.each(this.bubbles, (index, elem) => {
          var setupTimelineVisualization = (csv) => {
              elem.start(csv)
          }

          switch (this.input_format) {
              case "csv":
                  let filename = elem.file.split("/")[2]
                  let data = require("../data/" + filename)
                  d3.csv(data, setupTimelineVisualization);
                  break;

              case "json":
                  let php_script = require('services/getLatestRevision.php');
                  d3.json(php_script + "?vis_id=" + elem.file, setupTimelineVisualization);
                  break;

              default:
                  break;
          }
      });

      this.drawGrid();
      this.initMouseListeners();
  },

  
  ontofile: function(event, from, to, file) {
      this.force_areas.stop();
      this.force_papers.stop();

      this.current_file_number = file;

      // clear the canvas
      $("#chart_canvas").remove();

      // clear the list list
      $("#list_explorer").empty();

      // popup.current = "hidden";
      papers.current = "none";
      list.current = "none";

      // this.initScales();
      this.setOverflowToHiddenOrAuto("#main");

      // reset bubbles
      this.resetBubbles();

      var bubbles = this.bubbles[this.current_file_number];

      var setupVisualization = (csv) => {
          this.calcChartSize();
          this.setScaleRanges();

          this.drawChartCanvas();

          if (this.is_adaptive) {

              var url = this.createRestUrl();

              $.getJSON(url, (data) => {
                  this.startVisualization(this, bubbles, csv, data, false);
              });
          } else {
              this.startVisualization(this, bubbles, csv, null, false);
          }

          this.drawTitle()
      }

      switch (this.input_format) {
          case "csv":
              let filename = bubbles.file.split("/")[2]
              let data = require("../data/" + filename)
              d3.csv(data, setupVisualization);
              break;

          case "json":
              let php_script = require('services/getLatestRevision.php');
              d3.json(php_script + "?vis_id=" + bubbles.file, setupVisualization);
              break;

          default:
              break;
      }
  },


  startVisualization: function(hs, bubbles, csv, adaptive_data, popup_start) {
    bubbles.start( csv, adaptive_data );

    hs.initEventListeners();
    hs.initMouseListeners();
    hs.initForcePapers();
    hs.initForceAreas();

    papers.start( bubbles );
    // moving this to bubbles.start results in papers being displayed over the
    // bubbles, unfortunately
    bubbles.draw();

    bubbles.initMouseListeners();
    list.start( bubbles );

    hs.checkForcePapers();

    if (hs.show_intro) {
        $("#infolink").click();
    }

    $("#area_title>h2").each(function(index, value) {
      let text = $(value).text();
      $(value).text(h.hyphenateText(text));
    });

    $("#area_title_object>body").dotdotdot({wrap:"letter"});
  },

  drawNormalViewLink: function() {
      // remove event handler
      $("#timelineview").off("click");

      // refreshes page
      var link = ' <a href="" id="normal_link">Normal View</a>';
      $("#timelineview").html(link);
  }
}; // end HeadstartFSM prototype definition

// State definitions for headstart object
// see "onstart" function for entry point e.g. the first code that
// gets excuted here.
StateMachine.create({

  target: HeadstartFSM.prototype,

  events: [
    { name: "start",      from: "none",     to: "normal" },
    { name: "totimeline", from: ["normal", "switchfiles"],   to: "timeline" },
    { name: "tofile", from: ["normal", "switchfiles", "timeline"], to: "switchfiles"}
  ]

});
