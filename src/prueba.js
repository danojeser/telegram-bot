import fetch from 'node-fetch';


const allowedExtensions = ['jpg', 'jpeg', 'png'];
let fileExtesion = '';

while (!allowedExtensions.includes(fileExtesion)) {
    const response = await fetch('https://random.dog/woof.json');
    const data = await response.json();
    fileExtesion = data.url.split('.')[data.url.split('.').length - 1];

    console.log(data.url);
}




