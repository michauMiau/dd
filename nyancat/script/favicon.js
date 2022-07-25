var link = document.createElement('link');
link.type = 'image/x-icon';
link.rel = 'icon';
link.href = c.toDataURL(canvas);
document.getElementsByTagName('head')[0].appendChild(link);