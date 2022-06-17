/*
 
 This file is part of OpenWebRX,
 an open-source SDR receiver software with a web UI.
 Copyright (c) 2013-2015 by Andras Retzler <randras@sdr.hu>
 Copyright (c) 2019-2021 by Jakob Ketterl <dd5jfk@darc.de>
 Copyright (c) 2020-2022 by eroyee (https://github.com/eroyee/)
 
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as
 published by the Free Software Foundation, either version 3 of the
 License, or (at your option) any later version.
 
 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.
 
 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 
 """
 
 */

is_firefox = navigator.userAgent.indexOf("Firefox") >= 0;

var bandwidth;
var center_freq;
var fft_size;
var fft_compression = "none";
var fft_codec;
var waterfall_setup_done = 0;
var secondary_fft_size;
var StepHz = false; //eroyee - for 5 / 9 kHz stepchange

function updateVolume() {
    audioEngine.setVolume(parseFloat($("#openwebrx-panel-volume").val()) / 100);
}


function toggleMute() {
    var $muteButton = $('.openwebrx-mute-button');
    var $volumePanel = $('#openwebrx-panel-volume');
    if ($muteButton.hasClass('muted')) {
        $muteButton.removeClass('muted');
        $volumePanel.prop('disabled', false).val(volumeBeforeMute);
    } else {
        $muteButton.addClass('muted');
        volumeBeforeMute = $volumePanel.val();
        $volumePanel.prop('disabled', true).val(0);
    }
    updateVolume();
}

/* eroyee add for freq steps 22 Dec 2020, based on information from DJ1AN ----- 
 - note this is optimised for tuning precision of 10Hz. Furture improvement to 
   include that variable and adjust accordingly -----------------------------*/
function toggleStepHz() {
    if (StepHz) {
        StepHz = false;
        document.getElementById('stepchangeHz').innerHTML = "5";
        document.getElementById('stepchangeHz').style.backgroundColor = "#04AA6D";
    } else {
        StepHz = true;
        document.getElementById('stepchangeHz').innerHTML = "9";
        document.getElementById('stepchangeHz').style.backgroundColor = "blue";
    }
}

function freqstep(sel) {
    var stepsize = 0;
    var offset_frequency = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().get_offset_frequency();
    var new_offset = offset_frequency + stepsize;
    switch (sel) {
        case 0:
            if (StepHz) {
                stepsize = -9000;
            } 
            else {
                stepsize = -5000;
            }
            break;
        case 1:
            stepsize = -100;
            break;
        case 2:
            stepsize = -10;  // Will only work if 10Hz resolution is set
            break;
        case 3:
            stepsize = 10;  // Will only work if 10Hz resolution is set
            break;
        case 4:
            stepsize = 100;
            break;
        case 5:
            if (StepHz) {
                stepsize = 9000;
            } 
            else {
                stepsize = 5000;
            }
            break;
        default:
            stepsize = 0;
    }
    if (new_offset !== offset_frequency) {
        $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().set_offset_frequency(new_offset);
    }
}
/* -------------------------------------------------------------------------- */

/* eroyee add for keyboard tuning 28 Dec 20, step toggle May 2022 */

function init_key_listener(keypress) {
    document.addEventListener("keydown", function (keypress) {
        // End 
        if (keypress.keyCode == "35") {
            toggleStepHz();
        }
        // PgUp
        if (keypress.keyCode == "33") {
            freqstep(5);
        }
        // PgDwn
        if (keypress.keyCode == "34") {
            freqstep(0);
        }
        // Up cursor
        if (keypress.keyCode == "38") {
            freqstep(4);
        }
        // Down Cursor
        if (keypress.keyCode == "40") {
            freqstep(1);
        }
        if (keypress.keyCode == "37") {
            freqstep(2);
        }
        // Right Cursor
        if (keypress.keyCode == "39") {
            freqstep(3);
        }
    });
}
/*  ------------------------------------------------------------------------- */

/* --------- eroyee add for switching transparent (Ghost) RX panel ---------- */

var GhostRX = true;
function ToggleGhostRX() {
    if (GhostRX) {
        GhostRX = false;
        document.getElementById('GhostRX').innerHTML = "G";
        document.getElementById('GhostRX').style.backgroundColor = "rgba(255,255,255,0.3)"; // using rgba, 'a' is opacity value
        document.getElementById('GhostRX').style.fontWeight = "bold";
        document.getElementById('spectrum').style.backgroundColor = "rgba(255,165,0,0.3)"; // using rgba, 'a' is opacity value
        document.getElementById('openwebrx-panel-receiver').style.backgroundColor = "rgba(255,255,255,0)";
//    qs("#openwebrx-button").style.backgroundColor = "rgba(55,55,55,0)";
    } else {
        GhostRX = true;
        document.getElementById('GhostRX').innerHTML = "G";
        document.getElementById('GhostRX').style.backgroundColor = "black";
        document.getElementById('openwebrx-panel-receiver').style.backgroundColor = "black";
        document.getElementById('GhostRX').style.fontWeight = "normal";
        document.getElementById('spectrum').style.backgroundColor = "orange"; // using rgba, 'a' is opacity value
//        qs("#openwebrx-button").style.backgroundColor = "rgba(55,55,55,1)"; 
    }
}

/* -------------------------------------------------------------------------- */




function zoomInOneStep() {
    zoom_set(zoom_level + 1);
}

function zoomOutOneStep() {
    zoom_set(zoom_level - 1);
}

function zoomInTotal() {
    zoom_set(zoom_levels.length - 1);
}

function zoomOutTotal() {
    zoom_set(0);
}

var waterfall_min_level;
var waterfall_max_level;
var waterfall_min_level_default;
var waterfall_max_level_default;
var waterfall_colors = buildWaterfallColors(['#000', '#FFF']);
var waterfall_auto_levels;
var waterfall_auto_min_range;

function buildWaterfallColors(input) {
    return chroma.scale(input).colors(256, 'rgb');
}

function updateWaterfallColors(which) {
    var $wfmax = $("#openwebrx-waterfall-color-max");
    var $wfmin = $("#openwebrx-waterfall-color-min");
    waterfall_max_level = parseInt($wfmax.val());
    waterfall_min_level = parseInt($wfmin.val());
    if (waterfall_min_level >= waterfall_max_level) {
        if (!which) {
            waterfall_min_level = waterfall_max_level - 1;
        } else {
            waterfall_max_level = waterfall_min_level + 1;
        }
    }
    updateWaterfallSliders();
}

function updateWaterfallSliders() {
    $('#openwebrx-waterfall-color-max')
            .val(waterfall_max_level)
            .attr('title', 'Waterfall maximum level (' + Math.round(waterfall_max_level) + ' dB)');
    $('#openwebrx-waterfall-color-min')
            .val(waterfall_min_level)
            .attr('title', 'Waterfall minimum level (' + Math.round(waterfall_min_level) + ' dB)');
}

function waterfallColorsDefault() {
    waterfall_min_level = waterfall_min_level_default;
    waterfall_max_level = waterfall_max_level_default;
    updateWaterfallSliders();
    waterfallColorsContinuousReset();
}

function waterfallColorsAuto(levels) {
    var min_level = levels.min - waterfall_auto_levels.min;
    var max_level = levels.max + waterfall_auto_levels.max;
    max_level = Math.max(min_level + (waterfall_auto_min_range || 0), max_level);
    waterfall_min_level = min_level;
    waterfall_max_level = max_level;
    updateWaterfallSliders();
}

var waterfall_continuous = {
    min: -150,
    max: 0
};

function waterfallColorsContinuousReset() {
    waterfall_continuous.min = waterfall_min_level;
    waterfall_continuous.max = waterfall_max_level;
}

function waterfallColorsContinuous(levels) {
    if (levels.max > waterfall_continuous.max + 1) {
        waterfall_continuous.max += 1;
    } else if (levels.max < waterfall_continuous.max - 1) {
        waterfall_continuous.max -= 0.1;
    }
    if (levels.min < waterfall_continuous.min - 1) {
        waterfall_continuous.min -= 1;
    } else if (levels.min > waterfall_continuous.min + 1) {
        waterfall_continuous.min += 0.1;
    }
    waterfallColorsAuto(waterfall_continuous);
}
/* eroyee; don't need this if using js meter
 
 function setSmeterRelativeValue(value) {
 if (value < 0) value = 0;
 if (value > 1.0) value = 1.0;
 var $meter = $("#openwebrx-smeter");
 var $bar = $meter.find(".openwebrx-smeter-bar");
 $bar.css({transform: 'translate(' + ((value - 1) * 100) + '%) translateZ(0)'});
 if (value > 0.9) {
 // red
 $bar.css({background: 'linear-gradient(to top, #ff5939 , #961700)'});
 } else if (value > 0.7) {
 // yellow
 $bar.css({background: 'linear-gradient(to top, #fff720 , #a49f00)'});
 } else {
 // red
 $bar.css({background: 'linear-gradient(to top, #22ff2f , #008908)'});
 }
 }
 */

function setSquelchSliderBackground(val) {
    var $slider = $('#openwebrx-panel-receiver .openwebrx-squelch-slider');
    var min = Number($slider.attr('min'));
    var max = Number($slider.attr('max'));
    var sliderPosition = $slider.val();
    var relative = (val - min) / (max - min);
    // use a brighter color when squelch is open
    var color = val >= sliderPosition ? '#22ff2f' : '#008908';
    // we don't use the gradient, but separate the colors discretely using css tricks
    var style = 'linear-gradient(90deg, ' + color + ', ' + color + ' ' + relative * 100 + '%, #B6B6B6 ' + relative * 100 + '%)';
    $slider.css('--track-background', style);
}

function getLogSmeterValue(value) {
    return 10 * Math.log10(value);
}
/* eroyee, this is the original function (with mods) for css transform,
   replacement using js is below this block. CSS *should* be better but it 
   seems to increase CPU load considerably on low power machines:
 
 function setSmeterAbsoluteValue(value) //the value that comes from `csdr squelch_and_smeter_cc`
 {
 var logValue = getLogSmeterValue(value);
 setSquelchSliderBackground(logValue);
 var percent = (logValue + 100) / (100);  // waterfall min/max no longer affect s-meter, -0dBm should = 100%
 setSmeterRelativeValue(percent);
 $("#openwebrx-smeter-db").html(logValue.toFixed(1) + " dB");
 }
 
 */
/* eroyee function to draw smeter with js, is not as smooth, but is a *lot* 
   easier on remote CPU than using CSS transform; on a reasonable i7 
   (Linux + Firefox) with css transform the system load was ~3, with this 
   function it is typically < 2.
 
 Signal should cause bar to rise quickly once timeout has completed, then decay 
 slowly according to the value of decay.
                            
 This is probably more suited to SSB reception, particularly with the slow AGC 
 as per my mods, although it shouldn't adversely affect AM/FM in most cases. 
 
 SetTimeout is attempted in a probably futile effor to more closely sync bar
 movement with audio, expect this to vary with relative CPU speed etc. Quite 
 experimental and prob not be worth the effort...
 */


function setSmeterAbsoluteValue(value)
{
var speak = 0;
var decay = 0.01;
var logValue = getLogSmeterValue(value);
var percent = (logValue + 82) / (82);  // eroyee; changed this so smeter is not affected by waterfall settings, set figure to reflect -dBm without ant
    //    setTimeout(function(){
    $("#openwebrx-smeter-db").html(logValue.toFixed(0) + "dB"); // eroyee; re-introduce dB levels for anyone that wants them
//    },0.9);
    setSquelchSliderBackground(logValue);
    if (percent < 0) {
        percent = 0;
    }
    if (percent > 1.0) {
        percent = 1.0;
    }
    if (percent > speak) {
        speak = percent;
    } else {
        speak = (speak - decay);
    }
    setTimeout(function () {
        document.getElementById('openwebrx-smeter-bar').style.width = (speak * 100) + "%";
    }, 300);
// console.log(logValue, percent, speak);
}
/* -------------------------------------------------------------------------- */

function typeInAnimation(element, timeout, what, onFinish) {
    if (!what) {
        onFinish();
        return;
    }
    element.innerHTML += what[0];
    window.setTimeout(function () {
        typeInAnimation(element, timeout, what.substring(1), onFinish);
    }, timeout);
}


// ========================================================
// ================  DEMODULATOR ROUTINES  ================
// ========================================================

function getDemodulators() {
    return [
        $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator()
    ].filter(function (d) {
        return !!d;
    });
}

function mkenvelopes(visible_range) //called from mkscale
{
    var demodulators = getDemodulators();
    scale_ctx.clearRect(0, 0, scale_ctx.canvas.width, 22); //clear the upper part of the canvas (where filter envelopes reside)
    for (i = 0; i < demodulators.length; i++) {
        demodulators[i].envelope.draw(visible_range);
    }
    if (demodulators.length) {
        var bandpass = demodulators[0].getBandpass();
        secondary_demod_waterfall_set_zoom(bandpass.low_cut, bandpass.high_cut);
    }
}

function waterfallWidth() {
    return $('body').width();
}


// ========================================================
// ===================  SCALE ROUTINES  ===================
// ========================================================

var scale_ctx;
var scale_canvas;

function scale_setup() {
    scale_canvas = $("#openwebrx-scale-canvas")[0];
    scale_ctx = scale_canvas.getContext("2d");
    scale_canvas.addEventListener("mousedown", scale_canvas_mousedown, false);
    scale_canvas.addEventListener("mousemove", scale_canvas_mousemove, false);
    scale_canvas.addEventListener("mouseup", scale_canvas_mouseup, false);
    resize_scale();
    var frequency_container = $("#openwebrx-frequency-container");
    frequency_container.on("mousemove", frequency_container_mousemove, false);
}

var scale_canvas_drag_params = {
    mouse_down: false,
    drag: false,
    start_x: 0,
    key_modifiers: {shiftKey: false, altKey: false, ctrlKey: false}
};

function scale_canvas_mousedown(evt) {
    scale_canvas_drag_params.mouse_down = true;
    scale_canvas_drag_params.drag = false;
    scale_canvas_drag_params.start_x = evt.pageX;
    scale_canvas_drag_params.key_modifiers.shiftKey = evt.shiftKey;
    scale_canvas_drag_params.key_modifiers.altKey = evt.altKey;
    scale_canvas_drag_params.key_modifiers.ctrlKey = evt.ctrlKey;
    evt.preventDefault();
}

function scale_offset_freq_from_px(x, visible_range) {
    if (typeof visible_range === "undefined"){
        visible_range = get_visible_freq_range();
    }
    return (visible_range.start + visible_range.bw * (x / waterfallWidth())) - center_freq;
}

function scale_canvas_mousemove(evt) {
    var event_handled = false;
    var i;
    var demodulators = getDemodulators();
    if (scale_canvas_drag_params.mouse_down && !scale_canvas_drag_params.drag && Math.abs(evt.pageX - scale_canvas_drag_params.start_x) > canvas_drag_min_delta)
            //we can use the main drag_min_delta thing of the main canvas
            {
                scale_canvas_drag_params.drag = true;
                //call the drag_start for all demodulators (and they will decide if they're dragged, based on X coordinate)
                for (i = 0; i < demodulators.length; i++){
                    event_handled |= demodulators[i].envelope.drag_start(evt.pageX, scale_canvas_drag_params.key_modifiers);
                scale_canvas.style.cursor = "move";
                }
            } else if (scale_canvas_drag_params.drag) {
        //call the drag_move for all demodulators (and they will decide if they're dragged)
        for (i = 0; i < demodulators.length; i++){
            event_handled |= demodulators[i].envelope.drag_move(evt.pageX);
        }
        if (!event_handled){
            demodulators[0].set_offset_frequency(scale_offset_freq_from_px(evt.pageX));
        }
    }

}

function frequency_container_mousemove(evt) {
    var frequency = center_freq + scale_offset_freq_from_px(evt.pageX);
    $('#openwebrx-panel-receiver').demodulatorPanel().setMouseFrequency(frequency);
}

function scale_canvas_end_drag(x) {
    var i = 0;
    scale_canvas.style.cursor = "default";
    scale_canvas_drag_params.drag = false;
    scale_canvas_drag_params.mouse_down = false;
    var event_handled = false;
    var demodulators = getDemodulators();
    for (i = 0; i < demodulators.length; i++){
        event_handled |= demodulators[i].envelope.drag_end();
    }
    if (!event_handled){
        demodulators[0].set_offset_frequency(scale_offset_freq_from_px(x));
    }
}

function scale_canvas_mouseup(evt) {
    scale_canvas_end_drag(evt.pageX);
}

function scale_px_from_freq(f, range) {
    return Math.round(((f - range.start) / range.bw) * waterfallWidth());
}

function get_visible_freq_range() {
    if (!bandwidth){
        return false;
    }
    var fcalc = function (x) {
        var canvasWidth = waterfallWidth() * zoom_levels[zoom_level];
        return Math.round(((-zoom_offset_px + x) / canvasWidth) * bandwidth) + (center_freq - bandwidth / 2);
    };
    var out = {
        start: fcalc(0),
        center: fcalc(waterfallWidth() / 2),
        end: fcalc(waterfallWidth()),
    }
    out.bw = out.end - out.start;
    out.hps = out.bw / waterfallWidth();
    return out;
}

var scale_markers_levels = [
    {
        "large_marker_per_hz": 10000000, //large
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 5000000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 1000000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 0
    },
    {
        "large_marker_per_hz": 500000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    },
    {
        "large_marker_per_hz": 100000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    },
    {
        "large_marker_per_hz": 50000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 2
    },
    {
        "large_marker_per_hz": 10000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 2
    },
    {
        "large_marker_per_hz": 5000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 3
    },
    {
        "large_marker_per_hz": 1000,
        "estimated_text_width": 70,
        "format": "{x} MHz",
        "pre_divide": 1000000,
        "decimals": 1
    }
];
var scale_min_space_bw_texts = 50;
var scale_min_space_bw_small_markers = 7;

function get_scale_mark_spacing(range) {
    var out = {};
    var fcalc = function (freq) {
        out.numlarge = (range.bw / freq);
        out.large = waterfallWidth() / out.numlarge; //distance between large markers (these have text)
        out.ratio = 5; //(ratio-1) small markers exist per large marker
        out.small = out.large / out.ratio; //distance between small markers
        if (out.small < scale_min_space_bw_small_markers){
            return false;
        }
        if (out.small / 2 >= scale_min_space_bw_small_markers && freq.toString()[0] !== "5") {
            out.small /= 2;
            out.ratio *= 2;
        }
        out.smallbw = freq / out.ratio;
        return true;
    };
    for (i = scale_markers_levels.length - 1; i >= 0; i--) {
        var mp = scale_markers_levels[i];
        if (!fcalc(mp.large_marker_per_hz)){
            continue;
        }
        //console.log(mp.large_marker_per_hz);
        //console.log(out);
        if (out.large - mp.estimated_text_width > scale_min_space_bw_texts){
            break;
        }
    }
    out.params = mp;
    return out;
}

var range;

function mkscale() {
    //clear the lower part of the canvas (where frequency scale resides; the upper part is used by filter envelopes):
    range = get_visible_freq_range();
    if (!range){
        return;
    }
    mkenvelopes(range); //when scale changes we will always have to redraw filter envelopes, too
    scale_ctx.clearRect(0, 22, scale_ctx.canvas.width, scale_ctx.canvas.height - 22);
    scale_ctx.strokeStyle = "#fff";
    scale_ctx.font = "bold 11px sans-serif";
    scale_ctx.textBaseline = "top";
    scale_ctx.fillStyle = "#fff";
    var spacing = get_scale_mark_spacing(range);
    //console.log(spacing);
    var marker_hz = Math.ceil(range.start / spacing.smallbw) * spacing.smallbw;
    var text_h_pos = 22 + 10 + ((is_firefox) ? 3 : 0);
    var text_to_draw = '';
    var ftext = function (f) {
        text_to_draw = format_frequency(spacing.params.format, f, spacing.params.pre_divide, spacing.params.decimals);
    };
    var last_large;
    var x;
    while ((x = scale_px_from_freq(marker_hz, range)) <= window.innerWidth) {
        scale_ctx.beginPath();
        scale_ctx.moveTo(x, 22);
        if (marker_hz % spacing.params.large_marker_per_hz === 0) {  //large marker
            if (typeof first_large === "undefined"){
                var first_large = marker_hz;
            }
            last_large = marker_hz;
            scale_ctx.lineWidth = 3.5;
            scale_ctx.lineTo(x, 22 + 11);
            ftext(marker_hz);
            var text_measured = scale_ctx.measureText(text_to_draw);
            scale_ctx.textAlign = "center";
            //advanced text drawing begins
            if (zoom_level === 0 && (range.start + spacing.smallbw * spacing.ratio > marker_hz) && (x < text_measured.width / 2)) { //if this is the first overall marker when zoomed out...                  and if it would be clipped off the screen...
                if (scale_px_from_freq(marker_hz + spacing.smallbw * spacing.ratio, range) - text_measured.width >= scale_min_space_bw_texts) { //and if we have enough space to draw it correctly without clipping
                    scale_ctx.textAlign = "left";
                    scale_ctx.fillText(text_to_draw, 0, text_h_pos);
                }
            } else if (zoom_level === 0 && (range.end - spacing.smallbw * spacing.ratio < marker_hz) && (x > window.innerWidth - text_measured.width / 2)) { //     if this is the last overall marker when zoomed out...                 and if it would be clipped off the screen...
                if (window.innerWidth - text_measured.width - scale_px_from_freq(marker_hz - spacing.smallbw * spacing.ratio, range) >= scale_min_space_bw_texts) { //and if we have enough space to draw it correctly without clipping
                    scale_ctx.textAlign = "right";
                    scale_ctx.fillText(text_to_draw, window.innerWidth, text_h_pos);
                }
            } 
            else{
                scale_ctx.fillText(text_to_draw, x, text_h_pos); //draw text normally
            }
        } else {  //small marker
            scale_ctx.lineWidth = 2;
            scale_ctx.lineTo(x, 22 + 8);
        }
        marker_hz += spacing.smallbw;
        scale_ctx.stroke();
    }
    if (zoom_level !== 0) { // if zoomed, we don't want the texts to disappear because their markers can't be seen
        // on the left side
        scale_ctx.textAlign = "center";
        var f = first_large - spacing.smallbw * spacing.ratio;
        x = scale_px_from_freq(f, range);
        ftext(f);
        var w = scale_ctx.measureText(text_to_draw).width;
        if (x + w / 2 > 0){
            scale_ctx.fillText(text_to_draw, x, 22 + 10);
        }
        // on the right side
        f = last_large + spacing.smallbw * spacing.ratio;
        x = scale_px_from_freq(f, range);
        ftext(f);
        w = scale_ctx.measureText(text_to_draw).width;
        if (x - w / 2 < window.innerWidth){
            scale_ctx.fillText(text_to_draw, x, 22 + 10);
        }
    }
}

function resize_scale() {
    var ratio = window.devicePixelRatio || 1;
    var w = window.innerWidth;
    var h = 47;
    scale_canvas.style.width = w + "px";
    scale_canvas.style.height = h + "px";
    w *= ratio;
    h *= ratio;
    scale_canvas.width = w;
    scale_canvas.height = h;
    scale_ctx.scale(ratio, ratio);
    mkscale();
    bookmarks.position();
}

function canvas_get_freq_offset(relativeX) {
    var rel = (relativeX / canvas_container.clientWidth);
    return Math.round((bandwidth * rel) - (bandwidth / 2));
}

function canvas_get_frequency(relativeX) {
    return center_freq + canvas_get_freq_offset(relativeX);
}


function format_frequency(format, freq_hz, pre_divide, decimals) {
    var out = format.replace("{x}", (freq_hz / pre_divide).toFixed(decimals));
    var at = out.indexOf(".") + 4;
    while (decimals > 3) {
        out = out.substr(0, at) + "," + out.substr(at);
        at += 4;
        decimals -= 3;
    }
    return out;
}

var canvas_drag = false;
var canvas_drag_min_delta = 1;
var canvas_mouse_down = false;
var canvas_drag_last_x;
var canvas_drag_last_y;
var canvas_drag_start_x;
var canvas_drag_start_y;

function canvas_mousedown(evt) {
    canvas_mouse_down = true;
    canvas_drag = false;
    canvas_drag_last_x = canvas_drag_start_x = evt.pageX;
    canvas_drag_last_y = canvas_drag_start_y = evt.pageY;
    evt.preventDefault(); //don't show text selection mouse pointer
}

function canvas_mousemove(evt) {
    if (!waterfall_setup_done){
        return;
    }
    var relativeX = get_relative_x(evt);
    if (canvas_mouse_down) {
        if (!canvas_drag && Math.abs(evt.pageX - canvas_drag_start_x) > canvas_drag_min_delta) {
            canvas_drag = true;
            canvas_container.style.cursor = "move";
        }
        if (canvas_drag) {
            var deltaX = canvas_drag_last_x - evt.pageX;
            var dpx = range.hps * deltaX;
            if (
                    !(zoom_center_rel + dpx > (bandwidth / 2 - waterfallWidth() * (1 - zoom_center_where) * range.hps)) &&
                    !(zoom_center_rel + dpx < -bandwidth / 2 + waterfallWidth() * zoom_center_where * range.hps)
                    ) {
                zoom_center_rel += dpx;
            }
            resize_canvases(false);
            canvas_drag_last_x = evt.pageX;
            canvas_drag_last_y = evt.pageY;
            mkscale();
            bookmarks.position();
        }
    } else {
        $('#openwebrx-panel-receiver').demodulatorPanel().setMouseFrequency(canvas_get_frequency(relativeX));
    }
}

function canvas_container_mouseleave() {
    canvas_end_drag();
}

function canvas_mouseup(evt) {
var relativeX = get_relative_x(evt);
    if (!waterfall_setup_done){
        return;
    }
    if (!canvas_drag) {
        $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().set_offset_frequency(canvas_get_freq_offset(relativeX));
    } else {
        canvas_end_drag();
    }
    canvas_mouse_down = false;
}

function canvas_end_drag() {
    canvas_container.style.cursor = "crosshair";
    canvas_mouse_down = false;
}

function zoom_center_where_calc(screenposX) {
    return screenposX / waterfallWidth();
}

function get_relative_x(evt) {
    var relativeX = evt.offsetX || evt.layerX;
    if ($(evt.target).closest(canvas_container).length){
        return relativeX;
    }
    // compensate for the frequency scale, since that is not resized by the browser.
    var relatives = $(evt.target).closest('#openwebrx-frequency-container').map(function () {
        return evt.pageX - this.offsetLeft;
    });
    if (relatives.length){
        relativeX = relatives[0];
    }
    return relativeX - zoom_offset_px;
}

function canvas_mousewheel(evt) {
    if (!waterfall_setup_done){
        return;
    }
    var relativeX = get_relative_x(evt);
    var dir = (evt.deltaY / Math.abs(evt.deltaY)) > 0;
    zoom_step(dir, relativeX, zoom_center_where_calc(evt.pageX));
    evt.preventDefault();
}


var zoom_max_level_hps = 33; //Hz/pixel
var zoom_levels_count = 14;

function get_zoom_coeff_from_hps(hps) {
    var shown_bw = (window.innerWidth * hps);
    return bandwidth / shown_bw;
}

var zoom_levels = [1];
var zoom_level = 0;
var zoom_offset_px = 0;
var zoom_center_rel = 0;
var zoom_center_where = 0;

var smeter_level = 0;

function mkzoomlevels() {
    zoom_levels = [1];
    var maxc = get_zoom_coeff_from_hps(zoom_max_level_hps);
    if (maxc < 1){
        return;
    }
    // logarithmic interpolation
    var zoom_ratio = Math.pow(maxc, 1 / zoom_levels_count);
    for (i = 1; i < zoom_levels_count; i++){
        zoom_levels.push(Math.pow(zoom_ratio, i));
    }
}

function zoom_step(out, where, onscreen) {
    if ((out && zoom_level === 0) || (!out && zoom_level >= zoom_levels_count - 1)){
        return;
    }
    if (out){
        --zoom_level;
    }
    else{
        ++zoom_level;
    }
    zoom_center_rel = canvas_get_freq_offset(where);
    //console.log("zoom_step || zlevel: "+zoom_level.toString()+" zlevel_val: "+zoom_levels[zoom_level].toString()+" zoom_center_rel: "+zoom_center_rel.toString());
    zoom_center_where = onscreen;
    //console.log(zoom_center_where, zoom_center_rel, where);
    resize_canvases(true);
    mkscale();
    bookmarks.position();
}

function zoom_set(level) {
    if (!(level >= 0 && level <= zoom_levels.length - 1)){
        return;
    }
    level = parseInt(level);
    zoom_level = level;
    //zoom_center_rel=canvas_get_freq_offset(-canvases[0].offsetLeft+waterfallWidth()/2); //zoom to screen center instead of demod envelope
    zoom_center_rel = $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().get_offset_frequency();
    zoom_center_where = 0.5 + (zoom_center_rel / bandwidth); //this is a kind of hack
    resize_canvases(true);
    mkscale();
    bookmarks.position();
}

function zoom_calc() {
    var winsize = waterfallWidth();
    var canvases_new_width = winsize * zoom_levels[zoom_level];
    zoom_offset_px = -((canvases_new_width * (0.5 + zoom_center_rel / bandwidth)) - (winsize * zoom_center_where));
    if (zoom_offset_px > 0){
        zoom_offset_px = 0;
    }
    if (zoom_offset_px < winsize - canvases_new_width){
        zoom_offset_px = winsize - canvases_new_width;
    }
}

var networkSpeedMeasurement;
var currentprofile = {
    toString: function () {
        return this['sdr_id'] + '|' + this['profile_id'];
    }
};

var COMPRESS_FFT_PAD_N = 10; //should be the same as in csdr.c

function on_ws_recv(evt) {
    if (typeof evt.data === 'string') {
        // text messages
        networkSpeedMeasurement.add(evt.data.length);

        if (evt.data.substr(0, 16) === "CLIENT DE SERVER") {
            params = Object.fromEntries(
                    evt.data.slice(17).split(' ').map(function (param) {
                var args = param.split('=');
                return [args[0], args.slice(1).join('=')];
            })
                    );
            var versionInfo = 'Unknown server';
            if (params.server && params.server === 'openwebrx' && params.version) {
                versionInfo = 'OpenWebRX version: ' + params.version;
            }
            divlog('Server acknowledged WebSocket connection, ' + versionInfo);
        } else {
            try {
                var json = JSON.parse(evt.data);
                switch (json.type) {
                    case "config":
                        var config = json['value'];
                        if ('waterfall_colors' in config){
                            waterfall_colors = buildWaterfallColors(config['waterfall_colors']);
                        }
                        if ('waterfall_levels' in config) {
                            waterfall_min_level_default = config['waterfall_levels']['min'];
                            waterfall_max_level_default = config['waterfall_levels']['max'];
                        }
                        if ('waterfall_auto_levels' in config){
                            waterfall_auto_levels = config['waterfall_auto_levels'];
                        }
                        if ('waterfall_auto_min_range' in config){
                            waterfall_auto_min_range = config['waterfall_auto_min_range'];
                        }
                            waterfallColorsDefault();
                        var initial_demodulator_params = {};
                        if ('start_mod' in config){
                            initial_demodulator_params['mod'] = config['start_mod'];
                        }
                        if ('start_offset_freq' in config){
                            initial_demodulator_params['offset_frequency'] = config['start_offset_freq'];
                        }
                        if ('initial_squelch_level' in config){
                            initial_demodulator_params['squelch_level'] = Number.isInteger(config['initial_squelch_level']) ? config['initial_squelch_level'] : -150;
                        }
                        if ('samp_rate' in config){
                            bandwidth = config['samp_rate'];
                        }
                        if ('center_freq' in config){
                            center_freq = config['center_freq'];
                        }
                        if ('fft_size' in config) {
                            fft_size = config['fft_size'];
                            waterfall_clear();
                        }
                        if ('audio_compression' in config) {
                            var audio_compression = config['audio_compression'];
                            audioEngine.setCompression(audio_compression);
                            divlog("Audio stream is " + ((audio_compression === "adpcm") ? "compressed" : "uncompressed") + ".");
                        }
                        if ('fft_compression' in config) {
                            fft_compression = config['fft_compression'];
                            divlog("FFT stream is " + ((fft_compression === "adpcm") ? "compressed" : "uncompressed") + ".");
                        }
                        if ('max_clients' in config){
                            $('#openwebrx-bar-clients').progressbar().setMaxClients(config['max_clients']);
                        }
                        waterfall_init();

                                var demodulatorPanel = $('#openwebrx-panel-receiver').demodulatorPanel();
                        demodulatorPanel.setCenterFrequency(center_freq);
                        demodulatorPanel.setInitialParams(initial_demodulator_params);
                        if ('squelch_auto_margin' in config){
                            demodulatorPanel.setSquelchMargin(config['squelch_auto_margin']);
                        }
                        bookmarks.loadLocalBookmarks();

                        if ('sdr_id' in config || 'profile_id' in config) {
                            currentprofile['sdr_id'] = config['sdr_id'] || currentprofile['sdr_id'];
                            currentprofile['profile_id'] = config['profile_id'] || currentprofile['profile_id'];
                            $('#openwebrx-sdr-profiles-listbox').val(currentprofile.toString());

                            waterfall_clear();
                        }

                        if ('tuning_precision' in config){
                            $('#openwebrx-panel-receiver').demodulatorPanel().setTuningPrecision(config['tuning_precision']);
                        }
                        break;
                    case "secondary_config":
                        var s = json['value'];
                        secondary_fft_size = s['secondary_fft_size'] || secondary_fft_size;
                        secondary_bw = s['secondary_bw'] || secondary_bw;
                        if_samp_rate = s['if_samp_rate'] || if_samp_rate;
                        if (if_samp_rate){
                            secondary_demod_init_canvases();
                        }
                        break;
                    case "receiver_details":
                        $('.webrx-top-container').header().setDetails(json['value']);
                        break;
                    case "smeter":
                        smeter_level = json['value'];
                        setSmeterAbsoluteValue(smeter_level);
                        break;
                    case "cpuusage":
                        $('#openwebrx-bar-server-cpu').progressbar().setUsage(json['value']);
                        break;
                    case "clients":
                        $('#openwebrx-bar-clients').progressbar().setClients(json['value']);
                        break;
                    case "profiles":
                        var listbox = $("#openwebrx-sdr-profiles-listbox");
                        listbox.html(json['value'].map(function (profile) {
                            return '<option value="' + profile['id'] + '">' + profile['name'] + "</option>";
                        }).join(""));
                        $('#openwebrx-sdr-profiles-listbox').val(currentprofile.toString());
                        // this is a bit hacky since it only makes sense if the error is actually "no sdr devices"
                        // the only other error condition for which the overlay is used right now is "too many users"
                        // so there shouldn't be a problem here
                        if (Object.keys(json['value']).length) {
                            $('#openwebrx-error-overlay').hide();
                        }
                        break;
                    case "features":
                        Modes.setFeatures(json['value']);
                        break;
                    case "metadata":
                        $('.openwebrx-meta-panel').metaPanel().each(function () {
                            this.update(json['value']);
                        });
                        break;
                    case "dial_frequencies":
                        var as_bookmarks = json['value'].map(function (d) {
                            return {
                                name: d['mode'].toUpperCase(),
                                modulation: d['mode'],
                                frequency: d['frequency']
                            };
                        });
                        bookmarks.replace_bookmarks(as_bookmarks, 'dial_frequencies');
                        break;
                    case "bookmarks":
                        bookmarks.replace_bookmarks(json['value'], "server");
                        break;
                    case "sdr_error":
                        divlog(json['value'], true);
                        var $overlay = $('#openwebrx-error-overlay');
                        $overlay.find('.errormessage').text(json['value']);
                        $overlay.show();
                        $("#openwebrx-panel-receiver").demodulatorPanel().stopDemodulator();
                        break;
                    case "demodulator_error":
                        divlog(json['value'], true);
                        break;
                    case 'secondary_demod':
                        var value = json['value'];
                        var panels = [
                            $("#openwebrx-panel-wsjt-message").wsjtMessagePanel(),
                            $('#openwebrx-panel-packet-message').packetMessagePanel(),
                            $('#openwebrx-panel-pocsag-message').pocsagMessagePanel(),
                            $("#openwebrx-panel-js8-message").js8()
                        ];
                        if (!panels.some(function (panel) {
                            if (!panel.supportsMessage(value)){
                                return false;
                            }
                            panel.pushMessage(value);
                            return true;
                        })) {
                            secondary_demod_push_data(value);
                        }
                        break;
                    case 'log_message':
                        divlog(json['value'], true);
                        break;
                    case 'backoff':
                        divlog("Server is currently busy: " + json['reason'], true);
                        var $overlay = $('#openwebrx-error-overlay');
                        $overlay.find('.errormessage').text(json['reason']);
                        $overlay.show();
                        // set a higher reconnection timeout right away to avoid additional load
                        reconnect_timeout = 16000;
                        break;
                    case 'modes':
                        Modes.setModes(json['value']);
                        break;
                    default:
                        console.warn('received message of unknown type: ' + json['type']);
                }
            } catch (e) {
                // don't lose exception
                console.error(e);
            }
        }
    } else if (evt.data instanceof ArrayBuffer) {
        // binary messages
        networkSpeedMeasurement.add(evt.data.byteLength);

        var type = new Uint8Array(evt.data, 0, 1)[0];
        var data = evt.data.slice(1);

        var waterfall_i16;
        var waterfall_f32;
        var i;

        switch (type) {
            case 1:
                // FFT data
                if (fft_compression === "none") {
                    waterfall_add(new Float32Array(data));
                } else if (fft_compression === "adpcm") {
                    fft_codec.reset();

                    waterfall_i16 = fft_codec.decode(new Uint8Array(data));
                    waterfall_f32 = new Float32Array(waterfall_i16.length - COMPRESS_FFT_PAD_N);
                    for (i = 0; i < waterfall_i16.length; i++){
                        waterfall_f32[i] = waterfall_i16[i + COMPRESS_FFT_PAD_N] / 100;
                    }
                    waterfall_add(waterfall_f32);
                }
                break;
            case 2:
                // audio data
                audioEngine.pushAudio(data);
                break;
            case 3:
                // secondary FFT
                if (fft_compression === "none") {
                    secondary_demod_waterfall_add(new Float32Array(data));
                } else if (fft_compression === "adpcm") {
                    fft_codec.reset();

                    waterfall_i16 = fft_codec.decode(new Uint8Array(data));
                    waterfall_f32 = new Float32Array(waterfall_i16.length - COMPRESS_FFT_PAD_N);
                    for (i = 0; i < waterfall_i16.length; i++){
                        waterfall_f32[i] = waterfall_i16[i + COMPRESS_FFT_PAD_N] / 100;
                    }
                    secondary_demod_waterfall_add(waterfall_f32);
                }
                break;
            case 4:
                // hd audio data
                audioEngine.pushHdAudio(data);
                break;
            default:
                console.warn('unknown type of binary message: ' + type);
        }
    }
}

var waterfall_measure_minmax_now = false;
var waterfall_measure_minmax_continuous = false;

function waterfall_measure_minmax_do(what) {
    // this is based on an oversampling factor of about 1,25
    var ignored = 0.1 * what.length;
    var data = what.slice(ignored, -ignored);
    return {
        min: Math.min.apply(Math, data),
        max: Math.max.apply(Math, data)
    };
}

function on_ws_opened() {
    $('#openwebrx-error-overlay').hide();
    ws.send("SERVER DE CLIENT client=openwebrx.js type=receiver");
    divlog("WebSocket opened to " + ws.url);
    if (!networkSpeedMeasurement) {
        networkSpeedMeasurement = new Measurement();
        networkSpeedMeasurement.report(60000, 1000, function (rate) {
            $('#openwebrx-bar-network-speed').progressbar().setSpeed(rate);
        });
    } else {
        networkSpeedMeasurement.reset();
    }
    reconnect_timeout = false;
    ws.send(JSON.stringify({
        "type": "connectionproperties",
        "params": {
            "output_rate": audioEngine.getOutputRate(),
            "hd_output_rate": audioEngine.getHdOutputRate()
        }
    }));
}

var was_error = 0;

function divlog(what, is_error) {
    is_error = !!is_error;
    was_error |= is_error;
    if (is_error) {
        what = "<span class=\"webrx-error\">" + what + "</span>";
        toggle_panel("openwebrx-panel-log", true); //show panel if any error is present
    }
    $('#openwebrx-debugdiv')[0].innerHTML += what + "<br />";
    var nano = $('.nano');
    nano.nanoScroller();
    nano.nanoScroller({scroll: 'bottom'});
}

var volumeBeforeMute = 100.0;
var mute = false;

// Optimalise these if audio lags or is choppy:
var audio_buffer_maximal_length_sec = 1; //actual number of samples are calculated from sample rate

function onAudioStart(apiType) {
    divlog('Web Audio API succesfully initialized, using ' + apiType + ' API, sample rate: ' + audioEngine.getSampleRate() + " Hz");

    hideOverlay();

    // canvas_container is set after waterfall_init() has been called. we cannot initialize before.
    //if (canvas_container) synchronize_demodulator_init();

    //hide log panel in a second (if user has not hidden it yet)
    window.setTimeout(function () {
        toggle_panel("openwebrx-panel-log", !!was_error);
    }, 2000);

//eroyee added to hide status panel on start
    window.setTimeout(function () {
        toggle_panel("openwebrx-panel-status", !!was_error);
    }, 500);

    //Synchronise volume with slider
    updateVolume();
}

var reconnect_timeout = false;

function on_ws_closed() {
    var demodulatorPanel = $("#openwebrx-panel-receiver").demodulatorPanel();
    demodulatorPanel.stopDemodulator();
    demodulatorPanel.resetInitialParams();
    if (reconnect_timeout) {
        // max value: roundabout 8 and a half minutes
        reconnect_timeout = Math.min(reconnect_timeout * 2, 512000);
    } else {
        // initial value: 1s
        reconnect_timeout = 1000;
    }
    divlog("WebSocket has closed unexpectedly. Attempting to reconnect in " + reconnect_timeout / 1000 + " seconds...", 1);

    setTimeout(open_websocket, reconnect_timeout);
}

function on_ws_error() {
    divlog("WebSocket error.", 1);
}

var ws;

function open_websocket() {
    var protocol = window.location.protocol.match(/https/) ? 'wss' : 'ws';

    var href = window.location.href;
    var index = href.lastIndexOf('/');
    if (index > 0) {
        href = href.substr(0, index + 1);
    }
    href = href.split("://")[1];
    href = protocol + "://" + href;
    if (!href.endsWith('/')) {
        href += '/';
    }
    var ws_url = href + "ws/";

    if (!("WebSocket" in window)){
        divlog("Your browser does not support WebSocket, which is required for WebRX to run. Please upgrade to a HTML5 compatible browser.");
    }
    ws = new WebSocket(ws_url);
    ws.onopen = on_ws_opened;
    ws.onmessage = on_ws_recv;
    ws.onclose = on_ws_closed;
    ws.binaryType = "arraybuffer";
    window.onbeforeunload = function () { //http://stackoverflow.com/questions/4812686/closing-websocket-correctly-html5-javascript
        ws.onclose = function () {
        };
        ws.close();
    };
    ws.onerror = on_ws_error;
}

// -----------------------------------------------------------------------------
// eroyee; create an array to take percent raw data as inputted to 
// waterfall_mkcolour function. For eventual use by the spectrum display, it 
// gives data adjusted by waterfall levels but prior to colourmap interpretation.
const spec_data_in = [];
// -----------------------------------------------------------------------------
function waterfall_mkcolor(db_value, waterfall_colors_arg) {
    waterfall_colors_arg = waterfall_colors_arg || waterfall_colors;
    var value_percent = (db_value - waterfall_min_level) / (waterfall_max_level - waterfall_min_level);
    value_percent = Math.max(0, Math.min(1, value_percent));
    var scaled = value_percent * (waterfall_colors_arg.length - 1);
    spec_data_in.push(value_percent); // insert value_percent into array
    var index = Math.floor(scaled);
    var remain = scaled - index;
    if (remain === 0){
        return waterfall_colors_arg[index];
    }
    return color_between(waterfall_colors_arg[index], waterfall_colors_arg[index + 1], remain);
}

function color_between(first, second, percent) {
    return [
        first[0] + percent * (second[0] - first[0]),
        first[1] + percent * (second[1] - first[1]),
        first[2] + percent * (second[2] - first[2])
    ];
}


var canvas_context;
var canvases = [];
var canvas_default_height = 200;
var canvas_container;
var canvas_actual_line = -1;

function add_canvas() {
    var new_canvas = document.createElement("canvas");
    new_canvas.width = fft_size;
    new_canvas.height = canvas_default_height;
    canvas_actual_line = canvas_default_height;
    new_canvas.openwebrx_top = -canvas_default_height;
    new_canvas.style.transform = 'translate(0, ' + new_canvas.openwebrx_top.toString() + 'px)';
    canvas_context = new_canvas.getContext("2d");
    canvas_container.appendChild(new_canvas);
    canvases.push(new_canvas);
    while (canvas_container && canvas_container.clientHeight + canvas_default_height * 2 < canvases.length * canvas_default_height) {
        var c = canvases.shift();
        if (!c){
            break;
        }
        canvas_container.removeChild(c);
    }
}


function init_canvas_container() {
    canvas_container = $("#webrx-canvas-container")[0];
    canvas_container.addEventListener("mouseleave", canvas_container_mouseleave, false);
    canvas_container.addEventListener("mousemove", canvas_mousemove, false);
    canvas_container.addEventListener("mouseup", canvas_mouseup, false);
    canvas_container.addEventListener("mousedown", canvas_mousedown, false);
    canvas_container.addEventListener("wheel", canvas_mousewheel, false);
    var frequency_container = $("#openwebrx-frequency-container");
    frequency_container.on("wheel", canvas_mousewheel, false);
}

canvas_maxshift = 0;

function shift_canvases() {
    canvases.forEach(function (p) {
        p.style.transform = 'translate(0, ' + (p.openwebrx_top++).toString() + 'px)';
    });
    canvas_maxshift++;
}

function resize_canvases(zoom) {
    if (typeof zoom === "undefined"){
        zoom = false;
    }
    if (!zoom){
        mkzoomlevels();
    }
    zoom_calc();
    $('#webrx-canvas-container').css({
        width: waterfallWidth() * zoom_levels[zoom_level] + 'px',
        left: zoom_offset_px + "px"
    });
    // eroyee; add the spectrum canvas here so it can be 'natively' 'resized, rather than using observe
    $('#freq-canvas-spectrum').css({
        width: waterfallWidth() * zoom_levels[zoom_level] + 'px',
        left: zoom_offset_px + "px"
    });
}

function waterfall_init() {
    init_canvas_container();
    resize_canvases();
    scale_setup();
    mkzoomlevels();
    waterfall_setup_done = 1;
}

// ------------ eroyee add for start/stop spectrum display -------------- //

var spec_start = false;
const spec_window_h = 130; // sets height of spectrum display
const spec_out_data = [];
function display_spectra()
{
    if (!spec_start) {
        var divFreqSpectrum = '<div id="freq-div-spectrum">'
                + '<canvas id="freq-canvas-spectrum" width="' + (fft_size) + '" height="' + (spec_window_h) + '" style="width:100%;height:' + (spec_window_h) + 'px;left:0px;position:absolute;bottom:0px;">'
                + '</div>';
//eroyee; below to drop down spectrum container
        document.getElementById('spectrum_container').style.height = (spec_window_h) + "px";
        document.getElementById('spectrum_container').style.opacity = "1";
        var div = document.querySelector(".openwebrx-spectrum-container");
        div.insertAdjacentHTML('beforeEnd', divFreqSpectrum);
// eroyee; ensure new spectrum canvas is set with the same position and zoom level as the waterfall canvas
        document.querySelector("#freq-canvas-spectrum").style.left = document.querySelector("#webrx-canvas-container").style.left;
        document.querySelector("#freq-canvas-spectrum").style.width = document.querySelector("#webrx-canvas-container").style.width;
// eroyee; initialise the spectrum and peak data arrays
        for (i = 0; i < (fft_size); ++i){
            spec_peak_data[i] = 0; // initialise the peak data array with 0's
        }
        for (i = 0; i < (fft_size); ++i){
            spec_out_data[i] = 0;  // initialise the spectrum data array with 0's	    
        }
        spec_start = true;
    } else {
        if (spec_start) {
            spec_start = false;
            document.getElementById('spectrum_container').style.height = "0px";
            document.getElementById('spectrum_container').style.opacity = "0";
            const flush = document.querySelector("#freq-canvas-spectrum");
            flush.parentNode.removeChild(flush);
            spec_start = false;
            return;
        }
    }
}

// ----------------- eroyee for starting peak hold display ---------------------

const spec_peak_data = [];
var peak_start = false;
function peak_spectra_hold()
{
    if (!spec_start) {
        peak_start = false;
        return;
    }
    if (!peak_start) {
        peak_start = true;
        for (i = 0; i < (fft_size); ++i){
            spec_peak_data[i] = 0; // initialise the peak data array with 0's
        }
    }
    else if (peak_start) {
        peak_start = false;
        for (i = 0; i < (fft_size); ++i){
            spec_peak_data[i] = 0; // clear the peak data array with 0's
        }
    return;
    }
}



// ---- eroyee additions to waterfall_add function for spectrum display ----- //

function waterfall_add(data) {
var w = fft_size;
    if (!waterfall_setup_done){
        return;
    }
    if (waterfall_measure_minmax_now) {
        var levels = waterfall_measure_minmax_do(data);
        waterfall_measure_minmax_now = false;
        waterfallColorsAuto(levels);
        waterfallColorsContinuousReset();
    }

    if (waterfall_measure_minmax_continuous) {
        var level = waterfall_measure_minmax_do(data);
        waterfallColorsContinuous(level);
    }

    // create new canvas if the current one is full (or there isn't one)
    if (canvas_actual_line <= 0){
        add_canvas();
        }
    //Add line to waterfall image
    var oneline_image = canvas_context.createImageData(w, 1);
    for (x = 0; x < w; x++) {
        var color = waterfall_mkcolor(data[x]);
        for (i = 0; i < 3; i++){
            oneline_image.data[x * 4 + i] = color[i];
        }
        oneline_image.data[x * 4 + 3] = 255;
    }
    //Draw image
    canvas_context.putImageData(oneline_image, 0, --canvas_actual_line);
    shift_canvases();

// eroyee --------------------------------------------------------------SPECTRUM
    if (spec_start) {
        var freqSpectrumCtx;
        var freqSpectrumGradient;
// console.log (spec_start);
        freqSpectrumCtx = document.querySelector("#freq-canvas-spectrum").getContext('2d');
        freqSpectrumCtx.width = (fft_size);
        freqSpectrumCtx.height = (spec_window_h) - 1; // one less than canvas height
        freqSpectrumGradient = freqSpectrumCtx.createLinearGradient(0, 0, 0, freqSpectrumCtx.height);
        freqSpectrumGradient.addColorStop(0.00, 'red'); // probably should align these colours with the waterfall...
        freqSpectrumGradient.addColorStop(0.50, 'yellow');
        freqSpectrumGradient.addColorStop(1.00, 'blue');
//        if (spec_data_in.length = (freqSpectrumCtx.width)) {
        var y = 1;
// eroyee; spectrum height in pixels / dB range between wfmax & wfmin gives num pixels to draw first & subsequent reticule lines 10dB apart
// eg. If spec is 128px high, wft max is -19, wf min is -69 (ie.range is 50dB), then 128/(50/10) = 25.6 pixels to the first 10dB line
// Should probably round the outcome but that may use more CPU...
        const d = (freqSpectrumCtx.height / ((Math.abs(waterfall_min_level - waterfall_max_level)) / 10));
        freqSpectrumCtx.fillStyle = "#000";
        freqSpectrumCtx.fillRect(0, 0, freqSpectrumCtx.width, freqSpectrumCtx.height);
        freqSpectrumCtx.fillStyle = freqSpectrumGradient;
        const k = 0.6; // value to set filter rise/fall time, lower is slower
        for (i = 0; i < spec_data_in.length; i += 1) {
// ----------------------------- Filter types ------------------------------- //
// Other filter types, is it worth the hassle? Tried IIR and not that much 
// different from EMA....
// --------------------- EMA ------------------------------------------------ //
// eroyee; we are ultimately dealing with inputs of percent_value, a number 
// between 0 and 1, need to work with these numbers for *both* input and output 
// data for the ema filter to work correctly ()and multiply the output to fit 
// the canvas later on).The alternative is to first multiply the input value to
//  canvas height and go from there. I think this is better as it makes it a 
//  little easier to understand and possibly reduces the variable count slightly. 
//  Either should work.
//      var ema = ((spec_data_in[i]) * k) + (spec_out_data[i] * (1-k)); // use if utilising raw value_percent input
            var ema = (((spec_data_in[i]) * freqSpectrumCtx.height) * k) + (spec_out_data[i] * (1 - k)); // multiply raw by canvas height
            if (ema < 0){
                ema = 0;
            }
//        if (ema > 1) ema = 1; // needed if using raw value_percent input
                if (ema > freqSpectrumCtx.height){
                ema = freqSpectrumCtx.height;
            }
                spec_out_data[i] = ema;
//        spec_out_data[i] = ema * ((freqSpectrumCtx.height)-1);
            }
// -------------------------------------------------------------------------- //
// 
// -------------------------- Draw spectrum --------------------------------- //
        for (i = 0; i < freqSpectrumCtx.width; i++) {
//        var temp_h = spec_out_data[i] * (freqSpectrumCtx.height -1); // needed if using raw value_percent input	
            y = y + d; // reticule lines
            freqSpectrumCtx.fillStyle = "#FFF"; // white, remove this for colour coded lines
//---------------------------- reticule ----------------------------------------
            freqSpectrumCtx.fillRect(0, y, freqSpectrumCtx.width, 0.5);  // draw lines
            freqSpectrumCtx.fillStyle = freqSpectrumGradient; // remove if colour coded lines req'd
//------------------------------------------------------------------------------
//	    freqSpectrumCtx.fillRect(i, freqSpectrumCtx.height, 1, -temp_h);  // draw spectra // needed if using raw value_percent input
            freqSpectrumCtx.fillRect(i, freqSpectrumCtx.height, 1, -spec_out_data[i]);  // draw spectra
        }
// eroyee --------------------------------------------------------------SPECTRUM
// eroyee ------------------------------------------------------------ PEAK HOLD
// This draws a fine spectra line from the peak of the current data. It 
// maintains an array of peak data that is checked against the current data 
// output (from spec_out_data) on each cycle. If there are any data points in
// spec_out_data greater than the corresponding data in the spec_peak_data array 
// it will update spec_peak_data, which is then drawn out by a standard routine. 
// Starting and stopping is actioned via the peak_spectra_hold function.
    if (peak_start) {
        freqSpectrumCtx.lineWidth = 1;
        freqSpectrumCtx.strokeStyle = 'green';
        freqSpectrumCtx.beginPath();
        freqSpectrumCtx.moveTo(0, y);
        for (i = 0; i < freqSpectrumCtx.width; i++) {
            if (spec_out_data[i] > spec_peak_data[i]){
                spec_peak_data[i] = spec_out_data[i];
            }
            y = ((1 - spec_peak_data[i] / freqSpectrumCtx.height) * freqSpectrumCtx.height) - 1;
//                y = (1- spec_peak_data[i]/1) * ((freqSpectrumCtx.height) - 1); // needed if using raw value_percent input
            freqSpectrumCtx.lineTo(i, y);
            }
            freqSpectrumCtx.stroke();
        }
            spec_data_in.length = 0;    
    }
// eroyee ------------------------------------------------------------ PEAK HOLD
}

function waterfall_clear() {
    //delete all canvases
    while (canvases.length) {
        var x = canvases.shift();
        x.parentNode.removeChild(x);
    }
    canvas_actual_line = -1;
}

function openwebrx_resize() {
    resize_canvases();
    resize_scale();
}

function initProgressBars() {
    $(".openwebrx-progressbar").each(function () {
        var bar = $(this).progressbar();
        if ('setSampleRate' in bar) {
            bar.setSampleRate(audioEngine.getSampleRate());
        }
    });
}

function audioReporter(stats) {
    if (typeof (stats.buffersize) !== 'undefined') {
        $('#openwebrx-bar-audio-buffer').progressbar().setBuffersize(stats.buffersize);
    }

    if (typeof (stats.audioByteRate) !== 'undefined') {
        $('#openwebrx-bar-audio-speed').progressbar().setSpeed(stats.audioByteRate * 8);
    }

    if (typeof (stats.audioRate) !== 'undefined') {
        $('#openwebrx-bar-audio-output').progressbar().setAudioRate(stats.audioRate);
    }
}

var bookmarks;
var audioEngine;

function openwebrx_init() {
    audioEngine = new AudioEngine(audio_buffer_maximal_length_sec, audioReporter);
    var $overlay = $('#openwebrx-autoplay-overlay');
    $overlay.on('click', function () {
        audioEngine.resume();
    });
    audioEngine.onStart(onAudioStart);
    if (!audioEngine.isAllowed()) {
        $('body').append($overlay);
        $overlay.show();
    }
    fft_codec = new ImaAdpcmCodec();
    initProgressBars();
    open_websocket();
    secondary_demod_init();
    digimodes_init();
    initPanels();
    $('#openwebrx-panel-receiver').demodulatorPanel();
    window.addEventListener("resize", openwebrx_resize);
    bookmarks = new BookmarkBar();
    initSliders();
    /* ----- --eroyee add for keyboard tuning 28 Dec 20 --------------------- */
    init_key_listener();
    /* ---------------------------------------------------------------------- */
}

function initSliders() {
    $('#openwebrx-panel-receiver').on('wheel', 'input[type=range]', function (ev) {
        var $slider = $(this);
        if (!$slider.attr('step')){
            return;
        }
        var val = Number($slider.val());
        var step = Number($slider.attr('step'));
        if (ev.originalEvent.deltaY > 0) {
            step *= -1;
        }
        $slider.val(val + step);
        $slider.trigger('change');
    });

    var waterfallAutoButton = $('#openwebrx-waterfall-colors-auto');
    waterfallAutoButton.on('click', function () {
        waterfall_measure_minmax_now = true;
    }).on('contextmenu', function () {
        waterfall_measure_minmax_continuous = !waterfall_measure_minmax_continuous;
        waterfallColorsContinuousReset();
        waterfallAutoButton[waterfall_measure_minmax_continuous ? 'addClass' : 'removeClass']('highlighted');
        $('#openwebrx-waterfall-color-min, #openwebrx-waterfall-color-max').prop('disabled', waterfall_measure_minmax_continuous);

        return false;
    });
}

function digimodes_init() {
    // initialze DMR timeslot muting
    $('.openwebrx-dmr-timeslot-panel').click(function (e) {
        $(e.currentTarget).toggleClass("muted");
        update_dmr_timeslot_filtering();
        // don't mute when the location icon is clicked
    }).find('.location').click(function (e) {
        e.stopPropagation();
    });

    $('.openwebrx-meta-panel').metaPanel();
}

function update_dmr_timeslot_filtering() {
    var filter = $('.openwebrx-dmr-timeslot-panel').map(function (index, el) {
        return (!$(el).hasClass("muted")) << index;
    }).toArray().reduce(function (acc, v) {
        return acc | v;
    }, 0);
    $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().setDmrFilter(filter);
}

function hideOverlay() {
    var $overlay = $('#openwebrx-autoplay-overlay');
    $overlay.css('opacity', 0);
    $overlay.on('transitionend', function () {
        $overlay.hide();
    });
}

var rt = function (s, n) {
    return s.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + n) ? c : c - 26);
    });
};

// ========================================================
// =======================  PANELS  =======================
// ========================================================

function panel_displayed(el) {
    return !(el.style && el.style.display && el.style.display === 'none') && !(el.movement && el.movement === 'collapse');
}

function toggle_panel(what, on) {
    var item = $('#' + what)[0];
    if (!item){
        return;
    }
    var displayed = panel_displayed(item);
    if (typeof on !== "undefined" && displayed === on) {
        return;
    }
    if (displayed) {
        item.movement = 'collapse';
        item.style.transform = "perspective(600px) rotateX(90deg)";
        item.style.transitionProperty = 'transform';
    } else {
        item.movement = 'expand';
        item.style.display = null;
        setTimeout(function () {
            item.style.transitionProperty = 'transform';
            item.style.transform = 'perspective(600px) rotateX(0deg)';
        }, 20);
    }
    item.style.transitionDuration = "600ms";
    item.style.transitionDelay = "0ms";
}

function first_show_panel(panel) {
    panel.style.transitionDuration = 0;
    panel.style.transitionDelay = 0;
    var rotx = (Math.random() > 0.5) ? -90 : 90;
    var roty = 0;
    if (Math.random() > 0.5) {
        var rottemp = rotx;
        rotx = roty;
        roty = rottemp;
    }
    if (rotx !== 0 && Math.random() > 0.5){
        rotx = 270;
    }
    panel.style.transform = "perspective(600px) rotateX(%1deg) rotateY(%2deg)"
            .replace("%1", rotx.toString()).replace("%2", roty.toString());
    window.setTimeout(function () {
        panel.style.transitionDuration = "600ms";
        panel.style.transitionDelay = (Math.floor(Math.random() * 500)).toString() + "ms";
        panel.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg)";
    }, 1);
}

function initPanels() {
    $('#openwebrx-panels-container').find('.openwebrx-panel').each(function () {
        var el = this;
        el.openwebrxPanelTransparent = (!!el.dataset.panelTransparent);
        el.addEventListener('transitionend', function (ev) {
            if (ev.target !== el){
                return;
            }
            el.style.transitionDuration = null;
            el.style.transitionDelay = null;
            el.style.transitionProperty = null;
            if (el.movement && el.movement === 'collapse') {
                el.style.display = 'none';
            }
            delete el.movement;
        });
        if (panel_displayed(el)){
            first_show_panel(el);
        }
    });
}

/*
 _____  _       _                     _
 |  __ \(_)     (_)                   | |
 | |  | |_  __ _ _ _ __ ___   ___   __| | ___  ___
 | |  | | |/ _` | | '_ ` _ \ / _ \ / _` |/ _ \/ __|
 | |__| | | (_| | | | | | | | (_) | (_| |  __/\__ \
 |_____/|_|\__, |_|_| |_| |_|\___/ \__,_|\___||___/
 __/ |
 |___/
 */

var secondary_demod_fft_offset_db = 18; //need to calculate that later
var secondary_demod_canvases_initialized = false;
var secondary_demod_channel_freq = 1000;
var secondary_demod_waiting_for_set = false;
var secondary_demod_low_cut;
var secondary_demod_high_cut;
var secondary_demod_mousedown = false;
var secondary_demod_canvas_width;
var secondary_demod_canvas_left;
var secondary_demod_canvas_container;
var secondary_demod_current_canvas_actual_line;
var secondary_demod_current_canvas_context;
var secondary_demod_current_canvas_index;
var secondary_demod_canvases;
var secondary_bw = 31.25;
var if_samp_rate;

function secondary_demod_create_canvas() {
    var new_canvas = document.createElement("canvas");
    new_canvas.width = secondary_fft_size;
    new_canvas.height = $(secondary_demod_canvas_container).height();
    new_canvas.style.width = $(secondary_demod_canvas_container).width() + "px";
    new_canvas.style.height = $(secondary_demod_canvas_container).height() + "px";
    secondary_demod_current_canvas_actual_line = new_canvas.height - 1;
    $(secondary_demod_canvas_container).children().last().before(new_canvas);
    return new_canvas;
}

function secondary_demod_remove_canvases() {
    $(secondary_demod_canvas_container).children("canvas").remove();
}

function secondary_demod_init_canvases() {
    secondary_demod_remove_canvases();
    secondary_demod_canvases = [];
    secondary_demod_canvases.push(secondary_demod_create_canvas());
    secondary_demod_canvases.push(secondary_demod_create_canvas());
    secondary_demod_canvases[0].openwebrx_top = -$(secondary_demod_canvas_container).height();
    secondary_demod_canvases[1].openwebrx_top = 0;
    secondary_demod_canvases_update_top();
    secondary_demod_current_canvas_context = secondary_demod_canvases[0].getContext("2d");
    secondary_demod_current_canvas_actual_line = $(secondary_demod_canvas_container).height() - 1;
    secondary_demod_current_canvas_index = 0;
    secondary_demod_canvases_initialized = true;
    mkscale(); //so that the secondary waterfall zoom level will be initialized
}

function secondary_demod_canvases_update_top() {
    for (i = 0; i < 2; i++) {
        secondary_demod_canvases[i].style.transform = 'translate(0, ' + secondary_demod_canvases[i].openwebrx_top + 'px)';
    }
}

function secondary_demod_swap_canvases() {
    secondary_demod_canvases[0 + !secondary_demod_current_canvas_index].openwebrx_top -= $(secondary_demod_canvas_container).height() * 2;
    secondary_demod_current_canvas_index = 0 + !secondary_demod_current_canvas_index;
    secondary_demod_current_canvas_context = secondary_demod_canvases[secondary_demod_current_canvas_index].getContext("2d");
    secondary_demod_current_canvas_actual_line = $(secondary_demod_canvas_container).height() - 1;
}

function secondary_demod_init() {
    secondary_demod_canvas_container = $("#openwebrx-digimode-canvas-container")[0];
    $(secondary_demod_canvas_container)
            .mousemove(secondary_demod_canvas_container_mousemove)
            .mouseup(secondary_demod_canvas_container_mouseup)
            .mousedown(secondary_demod_canvas_container_mousedown)
            .mouseenter(secondary_demod_canvas_container_mousein)
            .mouseleave(secondary_demod_canvas_container_mouseleave);
    $('#openwebrx-panel-wsjt-message').wsjtMessagePanel();
    $('#openwebrx-panel-packet-message').packetMessagePanel();
    $('#openwebrx-panel-pocsag-message').pocsagMessagePanel();
    $('#openwebrx-panel-js8-message').js8();
}

function secondary_demod_push_data(x) {
    x = Array.from(x).filter(function (y) {
        var c = y.charCodeAt(0);
        return (c === 10 || (c >= 32 && c <= 126));
    }).map(function (y) {
        if (y === "&"){
            return "&amp;";
        }
        if (y === "<"){
            return "&lt;";
        }
        if (y === ">"){
            return "&gt;";
        }
        if (y === " "){
            return "&nbsp;";
        }
        if (y === "\n"){
            return "<br />";
        }
        return y;
    }).join("");
    $("#openwebrx-cursor-blink").before(x);
}

function secondary_demod_waterfall_add(data) {
    var w = secondary_fft_size;

    //Add line to waterfall image
    var oneline_image = secondary_demod_current_canvas_context.createImageData(w, 1);
    for (x = 0; x < w; x++) {
        var color = waterfall_mkcolor(data[x] + secondary_demod_fft_offset_db);
        for (i = 0; i < 3; i++){
            oneline_image.data[x * 4 + i] = color[i];
        }
        oneline_image.data[x * 4 + 3] = 255;
    }

    //Draw image
    secondary_demod_current_canvas_context.putImageData(oneline_image, 0, secondary_demod_current_canvas_actual_line--);
    secondary_demod_canvases.map(function (x) {
        x.openwebrx_top += 1;
    })
            ;
    secondary_demod_canvases_update_top();
    if (secondary_demod_current_canvas_actual_line < 0){
        secondary_demod_swap_canvases();
    }
}

function secondary_demod_update_marker() {
    var width = Math.max((secondary_bw / if_samp_rate) * secondary_demod_canvas_width, 5);
    var center_at = ((secondary_demod_channel_freq - secondary_demod_low_cut) / if_samp_rate) * secondary_demod_canvas_width;
    var left = center_at - width / 2;
    $("#openwebrx-digimode-select-channel").width(width).css("left", left + "px");
}

function secondary_demod_update_channel_freq_from_event(evt) {
    if (typeof evt !== "undefined") {
        var relativeX = (evt.offsetX) ? evt.offsetX : evt.layerX;
        secondary_demod_channel_freq = secondary_demod_low_cut +
                (relativeX / $(secondary_demod_canvas_container).width()) * (secondary_demod_high_cut - secondary_demod_low_cut);
    }
    if (!secondary_demod_waiting_for_set) {
        secondary_demod_waiting_for_set = true;
        window.setTimeout(function () {
            $('#openwebrx-panel-receiver').demodulatorPanel().getDemodulator().set_secondary_offset_freq(Math.floor(secondary_demod_channel_freq));
            secondary_demod_waiting_for_set = false;
        },
                50
                )
                ;
    }
    secondary_demod_update_marker();
}

function secondary_demod_canvas_container_mousein() {
    $("#openwebrx-digimode-select-channel").css("opacity", "0.7"); //.css("border-width", "1px");
}

function secondary_demod_canvas_container_mouseleave() {
    $("#openwebrx-digimode-select-channel").css("opacity", "0");
}

function secondary_demod_canvas_container_mousemove(evt) {
    if (secondary_demod_mousedown){
        secondary_demod_update_channel_freq_from_event(evt);
    }
}

function secondary_demod_canvas_container_mousedown(evt) {
    if (evt.which === 1){
        secondary_demod_mousedown = true;
    }
}

function secondary_demod_canvas_container_mouseup(evt) {
    if (evt.which === 1){
        secondary_demod_mousedown = false;
    }
    secondary_demod_update_channel_freq_from_event(evt);
}


function secondary_demod_waterfall_set_zoom(low_cut, high_cut) {
    if (!secondary_demod_canvases_initialized){
        return;
    }
    secondary_demod_low_cut = low_cut;
    secondary_demod_high_cut = high_cut;
    var shown_bw = high_cut - low_cut;
    secondary_demod_canvas_width = $(secondary_demod_canvas_container).width() * (if_samp_rate) / shown_bw;
    secondary_demod_canvas_left = (-secondary_demod_canvas_width / 2) - (low_cut / if_samp_rate) * secondary_demod_canvas_width;
    secondary_demod_canvases.map(function (x) {
        $(x).css({
            left: secondary_demod_canvas_left + "px",
            width: secondary_demod_canvas_width + "px"
        });
    });
    secondary_demod_update_channel_freq_from_event();
}

function sdr_profile_changed() {
    var value = $('#openwebrx-sdr-profiles-listbox').val();
    ws.send(JSON.stringify({type: "selectprofile", params: {profile: value}}));
}
