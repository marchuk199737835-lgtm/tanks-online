/* НЕОБОВ'ЯЗКОВО (запускається на вашому комп'ютері, не на сервері): замінює cdn.tailwindcss.com на локальний мінімальний CSS.
 * CDN-версія компілює стилі прямо в браузері телефона (десятки мс на кожну зміну DOM) і блокує показ сторінки; готовий CSS важить кілька КБ.
 *
 *   npx tailwindcss@3.4.17 -c tools/tailwind_build.config.cjs -i tools/tailwind_in.css -o public/css/tw.css --minify
 *
 * Потім в index.html: прибрати <script src="https://cdn.tailwindcss.com"></script> і блок `tailwind.config={...}`,
 * додати <link rel="stylesheet" href="css/tw.css"> ПЕРЕД css/style.css. Обов'язково переглянути гру на телефоні: класи, які JS складає
 * з шматків ('grid-cols-'+n), у вихідному коді не видно — їх треба додати в safelist нижче.
 * Версія 3.4.x навмисно та сама, що в CDN, щоб вигляд не змінився. */
module.exports = {
    content: ['./index.html', './game.js', './ui.js', './network.js', './config.js', './public/js/**/*.js'],
    safelist: [],
    theme: { extend: { screens: { lg: { raw: '(min-width:1024px) and (hover:hover) and (pointer:fine)' } } } }
};
