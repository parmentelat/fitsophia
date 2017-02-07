// -*- js-indent-level:2 -*-

var my_slices_name      = r2lab_accounts.map(function(account){return account['name'];}) // a list of slice hrns
var my_slices_color     = [];
var actionsQueue        = [];
var actionsQueued       = [];
var current_slice_name  = current_slice.name;
var current_slice_color = '#DDD';
var current_leases      = null;
var color_pending       = '#FFFFFF';
var color_removing      = '#FFFFFF';
var keepOldEvent        = null;
var theZombieLeases     = [];

// sidecar_url var is defined in template sidecar-url.js
// from sidecar_url as defined in settings.py
var socket              = io.connect(sidecar_url);
var version             = '1.37';
var refresh             = true;
var currentTimezone     = 'local';
var nigthly_slice_name  = 'inria_r2lab.nightly'
var nigthly_slice_color = '#000000';

var liveleases_debug = false;

function setSlice(element){
  var element_color = element.css("background-color");
  var element_name  = $.trim(element.text());
  setCurrentSliceBox(element_name)
  setCurrentSliceColor(element_color);
  setCurrentSliceName(element_name);
  setLastSlice();
}


function setCurrentSliceBox(element){
  id = idFormat(element);
  $(".noactive").removeClass('sactive');
  $("#"+id).addClass('sactive');
}


function setCurrentSliceColor(color){
  current_slice_color = color;
  return true;
}


function setCurrentSliceName(name){
  current_slice_name = name;
  return true;
}


function setLastSlice(){
  $.cookie("last-slice-data", getCurrentSliceName())
}


function idFormat(id){
  new_id = id.replace(/\./g, '');
  return new_id;
}


function getCurrentSliceName(){
  return shortName(current_slice_name);
}


function getCurrentSliceColor(){
  return current_slice_color;
}


function shortName(name){
  var new_name = name;
  new_name = name.replace('onelab.', '');
  return new_name
}


function getMySlicesName(){
  return my_slices_name;
}


function getMySlicesinShortName(){
  var new_short_names = [];
  $.each(getMySlicesName(), function(key,val){
    new_short_names.push(shortName(val));
  });
  return new_short_names;
}


function getMySlicesColor(){
  return my_slices_color;
}


function pendingName(name){
  var new_name = name;
  new_name = resetName(name) + ' (pending)';
  return new_name
}


function removingName(name){
  var new_name = name;
  new_name = resetName(name) + ' (removing)';
  return new_name
}


function resetName(name){
  var new_name = name;
  new_name = name.replace(' (pending)', '');
  new_name = new_name.replace(' (removing)', '');
  new_name = new_name.replace(' * failed *', '');
  return new_name
}


function failedName(name){
  var new_name = name;
  new_name = resetName(name) + ' * failed *';
  return new_name
}


function getRandomColor() {
  var reserved_colors = ["#A1A1A1", "#D0D0D0", "#FF0000", "#000000", "#FFE5E5", "#616161"];
  var letters = '0123456789ABCDEF'.split('');
  var color = '#';
  for (var i = 0; i < 6; i++ ) {
      color += letters[Math.round(Math.random() * 15)];
  }
  if ($.inArray(color.toUpperCase(), reserved_colors) > -1){
    getRandomColor();
  }
  return color;
}


// no extra 'onelab.' anymore
function fullName(name){
  return name;
}


function failedLease(lease){
  newLease = new Object();
  newLease.title = failedName(lease.title);
  newLease.id = lease.id;
  newLease.start = lease.start;
  newLease.end   = lease.end;
  newLease.color = "#FF0000";
  newLease.overlap = false;
  newLease.editable = false;
  return newLease;
}


function zombieLease(lease){
  newLease = new Object();
  newLease.title = failedName(lease.title);
  newLease.id = lease.uuid;
  newLease.start = lease.start;
  newLease.end   = lease.end;
  newLease.color = "#FF0000";``
  newLease.overlap = false;
  newLease.editable = false;
  return newLease;
}


function removeElementFromCalendar(id){
  $('#calendar').fullCalendar('removeEvents', id );
}


function diffArrays(first, second){
  var diff_array = null;
  diff_array = $(first).not(second).get()
  return diff_array;
}


function getLocalId(title, start, end){
  var id = null;
  var m_start = moment(start)._d.toISOString();
  var m_end   = moment(end)._d.toISOString();
  String.prototype.hash = function() {
    var self = this, range = Array(this.length);
    for(var i = 0; i < this.length; i++) {
      range[i] = i;
    }
    return Array.prototype.map.call(range, function(i) {
      return self.charCodeAt(i).toString(16);
    }).join('');
  }
  id = (title+m_start+m_end).hash();
  return id;
}


function getActionsQueue(){
  return actionsQueue;
}


function isRemoving(title){
  var removing = true;
  if(title.indexOf('(removing)') == -1){
    removing = false;
  }
  return removing;
}


function isPending(title){
  var pending = true;
  if(title.indexOf('(pending)') == -1){
    pending = false;
  }
  return pending;
}


function isNightly(title){
  var nightly = false;
  if (title){
    if(title.indexOf('nightly routine') > -1){
      nightly = true;
    }
  }
  return nightly;
}


function isFailed(title){
  var failed = true;
  if(title.indexOf('* failed *') == -1){
    failed = false;
  }
  return failed;
}


function addElementToCalendar(element){
  $('#calendar').fullCalendar('renderEvent', element, true );
}


function resetActionsQueue(){
  actionsQueued = [];
}


function getActionsQueued(){
  return actionsQueued;
}


function queueAction(title, start, end){
  var local_id = null;
  local_id = getLocalId(title, start, end);
  actionsQueued.push(local_id);
}


function setCurrentLeases(leases){
  current_leases = leases;
}


function getCurrentLeases(){
  return current_leases;
}


function setNightlyAndPast(){
  var notAllowedEvents = []
  //Nightly routine fixed in each nigth from 3AM to 5PM
  // newEvent = new Object();
  // newEvent.title = "nightly routine";
  // newEvent.id = "nightly";
  // newEvent.start = " T03:00:00Z";
  // newEvent.end   = " T04:00:00Z";
  // newEvent.color = "#616161";
  // newEvent.overlap = false;
  // newEvent.editable = false;
  // newEvent.dow = [0,1,2,3,4,5,6,7,8];
  // notAllowedEvents.push(newEvent);

  //Past dates
  newEvent = new Object();
  newEvent.id = "pastDate";
  newEvent.start = moment().format("YYYY-01-01T00:00:00Z");
  newEvent.end   = moment().format("YYYY-MM-DD");
  newEvent.overlap = false;
  newEvent.editable = false;
  newEvent.rendering = "background",
  newEvent.color = "#FFE5E5";
  notAllowedEvents.push(newEvent);

  return notAllowedEvents;
}


function createLease(lease){
  newLease             = new Object();
  newLease.id          = lease.id
  newLease.uuid        = lease.uuid
  newLease.title       = lease.title
  newLease.start       = lease.start
  newLease.end         = lease.end
  newLease.overlap     = lease.overlap
  newLease.editable    = lease.editable
  newLease.selectable  = lease.selectable
  newLease.color       = lease.color
  newLease.textColor   = lease.textColor

  return newLease;
}


function isPastDate(end){
  var past = false;
  if(moment().diff(end, 'minutes') > 0){
    past = true;
  }
  return past;
}


function adaptStart(start, end) {
  now = new Date();0
  started = moment(now).diff(moment(start), 'minutes');
  if (started > 0){
    s   = moment(now).diff(moment(start), 'minutes')
    ns  = moment(start).add(s, 'minutes');
    start = ns;
    //end = moment(end).add(1, 'hour');
  }
  //round to not wait
  start = moment(start).floor(10, 'minutes');
  return [start, end];
}


function isR2lab(name){
  var r2lab = false;
  if (name.substring(0, 13) == 'inria_'){
    r2lab = true;
  }
  return r2lab;
}


function sendMessage(msg, type){
  var cls   = 'danger';
  var title = 'Ooops!'
  if(type == 'info'){
    cls   = 'info';
    title = 'Info:'
  }
  if(type == 'success'){
    cls   = 'success';
    title = 'Yep!'
  }
  $('html,body').animate({'scrollTop' : 0},400);
  $('#messages').removeClass().addClass('alert alert-'+cls);
  $('#messages').html("<strong>"+title+"</strong> "+msg);
  $('#messages').fadeOut(200).fadeIn(200).fadeOut(200).fadeIn(200);
  $('#messages').delay(30000).fadeOut();
}


// xxx plcapi : do we still have zombies ?
function isZombie(obj){
  return false;

  var is_zombie = false;
  if(obj.resource_type == 'lease' && obj.status == 'pending' && isMySlice(shortName(obj.slicename))){
    is_zombie = true;
  }
  return is_zombie;
}


// use this to ask for an immediate refresh
// of the set of leases
// of course it must be called *after* the actual API call
// via django
function refreshLeases(){
  var msg = "INIT";
  if (liveleases_debug)
    console.log("sending on request:leases -> " + msg);
  socket.emit('request:leases', msg);
}

// show action immediately before it becomes confirmed
function showImmediate(action, event) {
  if (liveleases_debug) console.log("showImmediate");
  if (action == 'add'){
    var lease  = createLease(event);
    console.log("adding lease "+lease);
    $('#calendar').fullCalendar('renderEvent', lease, true );
  } else if (action == 'edit'){
    var lease  = createLease(event);
    removeElementFromCalendar(lease.id);
    $('#calendar').fullCalendar('renderEvent', lease, true );
  } else if (action == 'del'){
    var lease  = createLease(event);
    removeElementFromCalendar(lease.id);
    $('#calendar').fullCalendar('renderEvent', lease, true );
  }
}

function listenLeases(){
  socket.on('info:leases', function(msg){
    if (liveleases_debug) console.log("incoming info:leases");
    setCurrentLeases(msg);
    resetActionsQueue();
    var leases = getCurrentLeases();
    var leasesbooked = parseLeases(leases);
    refreshCalendar(leasesbooked);
    setCurrentSliceBox(getCurrentSliceName());
  });
}


function updateLeases(action, event){
  if (action == 'addLease') {
    showImmediate('add', event);
    setActionsQueue('add', event);
  } else if (action == 'editLease'){
    showImmediate('edit', event);
    setActionsQueue('edit', event);
  } else if (action == 'delLease') {
    if( ($.inArray(event.id, getActionsQueue()) == -1) && (event.title.indexOf('* failed *') > -1) ){
      removeElementFromCalendar(event.id);
    } else {
      setActionsQueue('del', event);
      showImmediate('del', event);
    }
  }
}


function setActionsQueue(action, data){
  var verb = null;
  var request = null;

  if(action == 'add'){
    verb = 'add';
    request = {
      "slicename"  : fullName(resetName(data.title)),
      "valid_from" : data.start._d.toISOString(),
      "valid_until": data.end._d.toISOString()
    };
    actionsQueue.push(data.id);
  }
  else if (action == 'edit'){
    verb = 'update';
    request = {
      "uuid" : data.uuid,
      "valid_from" : data.start._d.toISOString(),
      "valid_until": data.end._d.toISOString()
    };
  }
  else if (action == 'del'){
    verb = 'delete';
    request = {
      "uuid" : data.uuid,
    };
    delActionQueue(data.id);
  }
  else {
    console.log('Someting went wrong in map actions.');
    return false;
  }
  // xxx replace this with some more sensible code for showing errors
  var display_error_message = alert;
  post_xhttp_django("/leases/"+verb, request, function(xhttp) {
    if (xhttp.readyState == 4) {
      // this triggers a refresh of the leases once the sidecar server answers back
      refreshLeases();
      ////////// temporary
      // in all cases, show the results in console, in case we'd need to improve this
      // logic further on in the future
      if (liveleases_debug) console.log("upon ajax POST: xhttp.status = " + xhttp.status);
      ////////// what should remain
      if (xhttp.status != 200) {
	// this typically is a 500 error inside django
	// hard to know what to expect..
	sendMessage("Something went wrong when managing leases with code " + xhttp.status);
      } else {
	// the http POST has been successful, but a lot can happen still
	// for starters, are we getting a JSON string ?
	try {
	  var obj = $.parseJSON(xhttp.responseText);
	  if (obj['error']) {
	    if (obj['error']['exception']) {
	      if (obj['error']['exception']['reason']) {
		sendMessage(obj['error']['exception']['reason']);
	      } else {
		sendMessage(obj['error']['exception']);
	      }
	    } else {
	      sendMessage(obj['error']);
	    }
	  } else {
	    ;//sendMessage(obj);
	  }
	} catch(err) {
	  sendMessage("unexpected error while anayzing django answer " + err);
	}
      }
    }
  });
}


function setColorLeases(){
  var some_colors = $.cookie("some-colors-data")
  $.each(my_slices_name, function(key,obj){
    my_slices_color[key] = some_colors[key];
  });
  return my_slices_color;
}


function range(start, end) {
  return Array(end-start).join(0).split(0).map(function(val, id) {return id+start});
}


function saveSomeColors(){
  $.cookie.json = true;
  var local_colors = ["#F3537D", "#5EAE10", "#481A88", "#2B15CC", "#8E34FA", "#A41987", "#1B5DF8", "#7AAD82", "#8D72E4", "#323C89"]
  var some_colors = $.cookie("some-colors-data")

  if (! some_colors){
    some_colors = 0
  }
  if (local_colors.length >= my_slices_name.length) {
    $.cookie("some-colors-data", local_colors)
  }
  else {
    if (some_colors.length >= my_slices_name.length) {
      ;
    }else {
      var lack_colors = my_slices_name.length - local_colors.length;
      $.each(range(0,lack_colors), function(key,obj){
        local_colors.push(getRandomColor());
      });
      $.cookie("some-colors-data", local_colors)
    }
  }
}


function getColorLease(slice_title){
  var lease_color = '#A1A1A1';
  if ($.inArray(fullName(slice_title), getMySlicesName()) > -1){
    lease_color = my_slices_color[my_slices_name.indexOf(fullName(slice_title))];
  }
  return lease_color;
}


function delActionQueue(id){
  var idx = actionsQueue.indexOf(id);
  actionsQueue.splice(idx,1);
}


function resetZombieLeases(){
  theZombieLeases = [];
}


function resetActionQueue(){
  actionsQueue = [];
}


function resetCalendar(){
  $('#calendar').fullCalendar('removeEvents');
}


function getLastSlice(){
  $.cookie.json = true;
  var last_slice = $.cookie("last-slice-data")

  if ($.inArray(fullName(last_slice), getMySlicesName()) > -1){
    setCurrentSliceName(last_slice);
    $.cookie("last-slice-data", last_slice)
  }
  else {
    $.cookie("last-slice-data", getCurrentSliceName())
  }
}


function isMySlice(slice){
  var is_my = false;
  if ($.inArray(fullName(resetName(slice)), getMySlicesName()) > -1){
    is_my = true;
  }
  return is_my;
}


function isPresent(element, list){
  var present = false;

  if ($.inArray(element, list) > -1){
    present = true;
  }
  return present;
}


function getNightlyColor(){
  return nigthly_slice_color;
}


function buildSlicesBox(leases){
  // var knew_slices = getMySlicesinShortName();
  var slices = $("#my-slices");

  $.each(leases, function(key,val){
    if ($.inArray(val.title, knew_slices) === -1) { //already present?
      if (isMySlice(val.title)) {
        if(val.title === nigthly_slice_name){
          color = getNightlyColor();
          setCurrentSliceColor(color);
        }
        else if(val.title === getCurrentSliceName()){
          setCurrentSliceColor(val.color);
        }
        slices.append($("<div />").addClass('fc-event').attr("style", "background-color: "+ val.color +"").text(val.title)).append($("<div />").attr("id", idFormat(val.title)).addClass('noactive'));
      }// else{
      //   slices.append($("<div />").addClass('fc-event-not-mine').attr("style", "background-color: "+ val.color +"").text(val.title));
      // }
      knew_slices.push(val.title);
    }
  });

  $('#my-slices .fc-event').each(function() {
    $(this).draggable({
      zIndex: 999,
      revert: true,
      revertDuration: 0
    });
  });
}


var knew_slices = [];
function buildInitialSlicesBox(leases){
  setColorLeases();
  var slices = $("#my-slices");
  slices.html('<h4 align="center">drag & drop booking</h4>');

  $.each(leases, function(key,val){
    val = shortName(val);
    var color = getColorLease(val);
    if ($.inArray(val, knew_slices) === -1) { //removgin nightly routine and slices already present?
      if (isMySlice(val)) {
        if(val === nigthly_slice_name){
          color = getNightlyColor();
          setCurrentSliceColor(color);
        }
        else if(val === getCurrentSliceName()){
          setCurrentSliceColor(color);
        }
        slices.append($("<div />").addClass('fc-event').attr("style", "background-color: "+ color +"").text(val)).append($("<div />").attr("id", idFormat(val)).addClass('noactive'));
      } //else{
      //   slices.append($("<div />").addClass('fc-event-not-mine').attr("style", "background-color: "+ color +"").text(val));
      // }
      knew_slices.push(val);
    }
  });

  $('#my-slices .fc-event').each(function() {
    $(this).draggable({
      zIndex: 999,
      revert: true,
      revertDuration: 0
    });
  });
}


function refreshCalendar(events){
  if(refresh){

    $.each(events, function(key, event){
      if (liveleases_debug) console.log("refreshCalendar : lease = "+ event.title + ":" +
					event.start + " .. " + event.end);
      removeElementFromCalendar(event.id);
      $('#calendar').fullCalendar('renderEvent', event, true);
    });

    var each_removing = $("#calendar").fullCalendar( 'clientEvents' );
    $.each(each_removing, function(k,obj){
	  //when click in month view all 'thousands' of nightly comes.
	  //Maybe reset when comeback from month view (not implemented)
      if (!isNightly(obj.title) && obj.title) {
        if(isRemoving(obj.title)){
          removeElementFromCalendar(obj.id);
        }
        else if (obj.uuid && isPending(obj.title)){
          removeElementFromCalendar(obj.id);
        }
        else if (!isPresent(obj.id, actionsQueued) && !isPending(obj.title) && !isRemoving(obj.title) ){
          removeElementFromCalendar(obj.id);
        }
        else if (/*isPresent(obj.id, actionsQueue) &&*/ isPending(obj.title) && !obj.uuid ){
          removeElementFromCalendar(obj.id);
        }
      }
    });

    var failedEvents = [];
    $.each(theZombieLeases, function(k,obj){
      failedEvents.push(zombieLease(obj));
    });
    resetZombieLeases();
    $('#calendar').fullCalendar('addEventSource', failedEvents);

    resetActionQueue();
  }
}


function parseLeases(data){
  var parsedData = $.parseJSON(data);
  var leases = [];
  resetZombieLeases();

  parsedData.forEach(function(lease){
    newLease = new Object();
    newLease.title = shortName(lease.slicename);
    newLease.uuid = String(lease.uuid);
    newLease.start = lease.valid_from;
    newLease.end = lease.valid_until;
    newLease.id = getLocalId(newLease.title, newLease.start, newLease.end);
    newLease.color = getColorLease(newLease.title);
    if(isMySlice(newLease.title) && !isPastDate(newLease.end))
      newLease.editable = true;
    else
      newLease.editable = false;
    newLease.overlap = false;

    // //HARD CODE TO SET SPECIAL ATTR to nightly routine
    if(newLease.title == nigthly_slice_name){
      newLease.color = getNightlyColor();
    }

    if(isZombie(lease)){
      theZombieLeases.push(newLease);
      var request = {"uuid" : newLease.uuid};
      post_xhttp_django('/leases/delete', request, function(xhttp) {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
          if (liveleases_debug) console.log("return from /leases/delete");
          if (liveleases_debug) console.log(request);
        }
      });
    }
    else {
      leases.push(newLease);
      queueAction(newLease.title, newLease.start, newLease.end);
    }

  });
  buildSlicesBox(leases);
  if($(location).attr('pathname') == '/run.md'){
    $.merge(leases, setNightlyAndPast()); //present in run
  }
  return leases;
}

console.log("liveleases common version " + version);
