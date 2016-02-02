$(document).ready(function() {

  var list_of_my_slices   = ['onelab.inria.r2lab.mario_test', 'onelab.inria.r2lab.admin', 'onelab.inria.mario.tutorial', 'onelab.inria.mario.script'];
  var current_slice_name  = 'onelab.inria.mario.script';
  var current_slice_color = '#ddd';

  function buildCalendar(events) {

    var socket  = io();
    var today   = moment().format("YYYY-MM-DD");
    var path_to_leases_complete = events;
    var date = new Date();

    $('#my-slices .fc-event').each(function() {
      // store data so the calendar knows to render an event upon drop
      var last_drag_color = $(this).css("background-color");
      var last_drag_name  = $.trim($(this).text());

      $(this).data('event', {
        title: last_drag_name,
        color: last_drag_color,
        overlap: false,
        selectable: true,
        editable: true,
      });

      // make the event draggable using jQuery UI
      $(this).draggable({
        zIndex: 999,
        revert: true,      // will cause the event to go back to its
        revertDuration: 0  //  original position after the drag
      });
    });

    //Create the calendar
    $('#calendar').fullCalendar({
      header: {
        left: 'prev,next today',
        center: 'title',
        right: 'agendaDay,agendaThreeDay,agendaWeek',
      },

      views: {
        agendaThreeDay: {
          type: 'agenda',
          duration: { days: 3 },
          buttonText: '3 days'
        }
      },
      defaultTimedEventDuration: '00:30:00',
      forceEventDuration: true,
      defaultView: 'agendaThreeDay',
      timezone: 'Europe/Paris',
      defaultDate: today,
      selectable: true,
      selectHelper: false,
      overlap: false,
      editable: true,
      allDaySlot: false,
      droppable: true,

      //Events
      select: function(start, end, event, view) {
        //Avoid past dates when try to book a lease
        if (moment().diff(start, 'days') > 0) {
          $('#calendar').fullCalendar('unselect');
          $('#messages').fadeOut(200).fadeIn(200).fadeOut(200).fadeIn(200);
          $('#messages').delay(2000).fadeOut();
          return false;
        }
        var my_title = getCurrentSliceName();
        var eventData;
        if (my_title) {
          eventData = {
            title: my_title,
            start: start,
            end: end,
            //end: start+ ((3600*1000)*1),
            overlap: false,
            editable: true,
            allDaySlot: false,
            color: getCurrentSliceColor()
          };

          //receive the event information when click
          socket.emit('addlease', eventData);
        }
        $('#calendar').fullCalendar('unselect');
      },
      // this allows things to be dropped onto the calendar
      drop: function(start, end, event, date) {
        //set the current color after use one slice
        var element = $(this);
        var last_drag_color = element.css("background-color");
        var last_drag_name  = $.trim(element.text());

        setCurrentSliceColor(last_drag_color);
        setCurrentSliceName(last_drag_name);
        setCurrentSliceBox(element.text());
			},
      //Remove leases with double click
      eventRender: function(event, element) {
        element.bind('dblclick', function() {
          if (event.title == getCurrentSliceName()) {
            socket.emit('dellease', event._id);
          }
        });
      },
      //Events from Json file
      events: path_to_leases_complete,
    });
  }


  function parseLease(url){
    var all_leases_for_calendar;
    $.ajax({
      url: url,
      async: false,
      success: function(data) {
        var leases = [];

        $.each(data, function(key,val){
          $.each(val.resource_response.resources, function(k,v){

            newLease = new Object();
            newLease.title = shortName(v.account.name);
            newLease.start = v.valid_from;
            newLease.end   = v.valid_until;
            newLease.color = setColorLease(leases, newLease.title);
            newLease.editable = false;
            newLease.overlap = false;
            leases.push(newLease);
          });
        });

        buildSlicesBox(leases);

        //Nightly routine fixed in each nigth from 3AM to 5PM
        newLease = new Object();
        newLease.title = "nightly routine";
        newLease.id = "nightly";
        newLease.start = " T03:00:00Z";
        newLease.end   = " T05:00:00Z";
        newLease.color = "#616161";
        newLease.overlap = false;
        newLease.editable = false;
        newLease.dow = [0,1,2,3,4,5,6,7,8];
        leases.push(newLease);

        //Past dates
        newLease = new Object();
        newLease.id = "pastDate";
        newLease.start = "2016-01-01T00:00:00Z";
        newLease.end   = "2016-02-02T00:00:00Z";
        newLease.overlap = false;
        newLease.editable = false;
        newLease.rendering = "background",
        newLease.color = "#ffe5e5";
        leases.push(newLease);

        all_leases_for_calendar = leases;
      }
    });
    return all_leases_for_calendar;
  }


  function updateLeases(){
    var socket = io();
    socket.on('addlease', function(msg){
      $('#calendar').fullCalendar('renderEvent', msg, true );
    });
    socket.on('dellease', function(msg){
      $('#calendar').fullCalendar('removeEvents',msg);
    });
  }


  function getRandomColor() {
    var predefinied = ['#Cf625F','#A58BD3','#ff9fB5','#A1D490','#9099D4']
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
  }


  function fullName(name){
    var new_name;
    new_name = 'onelab.inria.'+name;
    return new_name
  }


  function shortName(name){
    var new_name;
    new_name = name.replace('onelab.inria.', '');
    return new_name
  }


  function getCurrentSliceName(){
    // var current_slice_name = $('#current-slice').attr('data-current-slice-name');
    return shortName(current_slice_name);
  }


  function getCurrentSliceColor(){
    // var current_slice_color = $('#current-slice').attr('data-current-slice-color');
    return current_slice_color;
  }


  function setCurrentSliceColor(color){
    // $('#current-slice').attr('data-current-slice-color', color);
    current_slice_color = color;
    return true;
  }


  function setCurrentSliceName(name){
    // $('#current-slice').attr('data-current-slice-name', name);
    current_slice_name = name;
    return true;
  }


  function setColorLease(leases, lease){
    var lease_color = '#d0d0d0'; //color for other slices that not yours

    $.each(leases, function(key,val){
      if (isMySlice(val.title)){
        if (val.title == lease){ //set the same lease color for the slice
          lease_color = val.color;
          return false;
        }
      }
      else {
        lease_color = getRandomColor();
      }
    });
    return lease_color;
  }


  function idFormat(id){
    new_id = id.replace('.', '');
    return new_id;
  }


  function setCurrentSliceBox(element){
    id = idFormat(element);
    $(".noactive").removeClass('sactive');
    $("#"+id).addClass('sactive');
  }


  function isMySlice(slice){
    var is_my = false;
    if ($.inArray(fullName(slice), getMySlices()) > -1){
      is_my = true;
    }
    return is_my
  }


  function buildSlicesBox(leases){
    var knew = [];
    var slices = $("#my-slices");

    $.each(leases, function(key,val){
      if ($.inArray(val.title, knew) === -1) { //already present?
        if (isMySlice(val.title)) {
          if(val.title === getCurrentSliceName()){
            setCurrentSliceColor(val.color);
          }
          knew.push(val.title);
          slices.append($("<div />").addClass('fc-event').attr("style", "background-color: "+ val.color +"").text(val.title)).append($("<div />").attr("id", idFormat(val.title)).addClass('noactive'));
        } else{
          slices.append($("<div />").addClass('fc-event-not-mine').attr("style", "background-color: "+ val.color +"").text(val.title));
        }
      }
    });
  }


  function getMySlices(){
    // list_of_my_slices = ['onelab.inria.r2lab.mario_test', 'onelab.inria.r2lab.admin', 'onelab.inria.mario.tutorial', 'onelab.inria.mario.script']
    return list_of_my_slices;
  }


  function main (){
    var leasesbooked  = parseLease('/leasesbooked');
    buildCalendar(leasesbooked);
    setCurrentSliceBox(getCurrentSliceName());
    updateLeases();
  }


  $('#confirm').click(function() {
    calendar = $('#calendar').fullCalendar('clientEvents')
    leases = [];
    leases_avoid = ['nightly', 'pastDate'];
    $.each(calendar, function(key,obj){
      var lease = new Object();

      lease.name  = fullName(obj.title);
      lease.start = obj.start._d;
      lease.end   = obj.end._d;
      if ($.inArray(obj.id, leases_avoid) === -1) {
        leases.push(lease);
      }
    });

    console.log(leases);
    console.log(leases.length);
    alert('The objects are in the console... yet');

  });


  Slice = function (name, color) {
    this.name  = name;
    this.color = color;

    this.getColor = function() {
      return this.color;
    }
    this.setColor = function(color) {
      this.color = color;
    }
  };


  main();
});
