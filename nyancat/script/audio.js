checkBox = document.getElementById('play');
if(checkBox.checked) {

    var audio = new Audio("nyancat.mp3");

    audio.play();
}
else{
    audio.pause();
}