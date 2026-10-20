function handler(event) {
  var req = event.request;
  var uri = req.uri;
  if (uri.indexOf('.') === -1) { req.uri = '/index.html'; }
  return req;
}
