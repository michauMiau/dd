var link = document.createElement('link');
link.type = 'image/x-icon';
link.rel = 'shortcut icon';
link.href = c.toDataURL();
document.getElementsByTagName('head')[0].appendChild(link);