/************************************/
/* INITS FOR MOBILE SITE
/************************************/
mobile = {}, // Init mobile subspace
mobile.cache = {}, // Add empty mobile cache
mobile.domain = location.hostname, // Get site hostname

// add popstate function to enable browser back button navigation
window.onpopstate = function () {
	initLoader();
	mobile.isBack = true;
	resolveUrl($.extend(true, {}, location));
};
// force a popstate on initial load to request the first page
// NB call to popstate is inconsistent across browsers: http://code.google.com/p/chromium/issues/detail?id=63040&q=popstate&colspec=ID%20Stars%20Pri%20Area%20Feature%20Type%20Status%20Summary%20Modified%20Owner%20Mstone%20OS
window.onpopstate();


/************************************/
/* FUNCTIONS FOR MOBILE FRAMEWORK
/************************************/

// URL RESOLVER
//resolves the request url when given an a-tag with a href attibute or a location object
//no error handling for wrong param type
function resolveUrl(link) {
	if (link === undefined) {
		return;
	}
	//Check if the link is external or specified with nohash and do redirect to requested page (leaving mobile site)
	if (link.hostname !== mobile.domain || $(link).attr('nohash') === 'true') {
		window.location = link.href;
	}
	else {
		//If the link doesn't have the json param to request json data from sitecore, add it to the query
		if (link.href.indexOf('JSON=1') === -1) {
			link.href += link.href.indexOf('?') !== -1 ? '&' : '?';
			link.href += 'JSON=1';
		}
		//remove #! to get a valid sitecore url to request
		if (link.href.indexOf('#!') !== -1) {
			link.href = link.href.replace('/#!', '');
		}
		//call service function with generated url
		serviceRequest(link.href);
	}
};

// SERVICE REQUEST
//generic service request to return json object
function serviceRequest(link) {
	//check if the requested page has been cached earlier
	if (typeof (mobile.cache[link]) === 'object') {
		//call render function with cached data
		displayContent(link);
	}
	//if not cached request data from server
	else {
		$.getJSON(link, function (data) {
			if (data.systemMeta.lang !== '') {
				//pass data to cache
				mobile.cache[link] = data;
				renderJSON(link);
			}
		});
	}
};

// RENDER DATA
// render json return data, pass as data param, optional - pass template name to forceTmpl param to overwrite template in data - pass id to specify spicific caching id
function renderJSON(link, forceTmpl, id) {
	var data = (typeof link === 'string') ? mobile.cache[link] : link,
	cacheId = (typeof link === 'string') ? link : id,
	$tmpl = (forceTmpl === undefined) ? $('#tmpl-' + data.content.metaData.pageType.replace(/\s/g, '')) : $('#tmpl-' + forceTmpl);
	//if template is not blank run it
	if ($tmpl.length > 0) {
		//if the data format is valid "mobile" data add the page title to the cache object
		if (data.content !== undefined) {
			mobile.cache[cacheId].title = data.content.title;
		}
		//run jquery template and cache if possible
		mobile.cache[cacheId].content = $tmpl.tmpl(data);
		updateLocation(link);
		displayContent(cacheId);
	}
	else {
		errorHandler('Page template could not be found');
		return;
	}
};

// DISPLAY CONTENT
function displayContent(cacheId) {
	//build stage for new data
	$('#frame').tmpl().prependTo('#contentFrame');
	//run jquery template
	mobile.cache[cacheId].content.prependTo('#staging');
	//update the page title
	$('title').text(mobile.cache[cacheId].title);
	clearLoader();
}

// LOADER
function initLoader() {
	$('#loader').css('display', 'block');
};
function clearLoader(noContent) {
	$('#loader').css('display', 'none');
	//remove old content, if noContent is set to true there is no new content and just the loader is cleared
	if (noContent !== true) {
		$('#content').remove();
		//fade in new content and update id's
		$('#staging').show();
		$('#staging').attr('id', 'content');
		$('#stagingNav').attr('id', 'nav');
	}
};

// ERRROR HANDLER
function errorHandler(txt) {
	clearLoader(true);
	alert(txt);
}

// UPDATE LOCATION
function updateLocation(link) {
	//pass the new page to the browsers history object to allow use of browser back button
	history.pushState('', '', '/#!' + link.slice(link.indexOf(mobile.domain) + mobile.domain.length, link.indexOf('JSON') - 1));
};

// PARSE .NET DATE
function getDate(dateString) {
	dateString = dateString.match(/(?:-|\+)?\d+/);
	dateString = new Date(parseInt(dateString));
	return dateString.getDate() + '/' + dateString.getMonth() + ' - ' + dateString.getFullYear();
}


$j(document).ready(function () {
	// GENERIC GLOBAL CLICK HANDLER
	//all a tags with a href attr is grabbed and passed to the resolveUrl function
	$j('a:link').live('click', function (e) {
		e.preventDefault();
		initLoader();
		resolveUrl(this);
	});
});

/************************************/
/* DEALER LOCATOR
/* Using google maps for zipcode -> lat/lng convertion
/************************************/
function requestCoords(useGps) {
	var zip = (useGps === true) ? true : $j('#storeLocatorZipCode').val(),
    geocoder = new google.maps.Geocoder();
	initLoader();
	if (zip === true) {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
			function (position) {
				getStoreData(position.coords.latitude, position.coords.longitude);
			},
			function () {
				errorHandler('No position could be determined or the gps is not active');
			},
			{ maximumAge: 180000 }
		);
		}
	}
	else if (zip != '') {
		geocoder.geocode({ 'address': zip + ',Denmark' }, function (results, status) {
			getStoreData(results[0].geometry.location.lat(), results[0].geometry.location.lng());
		});
	}
	return false;
};
function getStoreData(lat, lng) {
	$.ajax({
		type: 'GET',
		url: '/Services/StoreLocatorService.svc/GetNearestStoresByPosition?latitude=' + lat + '&longitude=' + lng + '&numberOfStores=10',
		dataType: 'json',
		success: buildResults,
		error: errorHandler('Kunne ikke hente forhandler data')
	});
}
function buildResults(data) {
	data.content = { title: 'Butikker nær dig' };
	mobile.cache['||stores'] = data;
	renderJSON('||stores', 'StoreListItem', 'stores');
}