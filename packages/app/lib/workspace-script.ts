/**
 * Script inline del `<head>`: fija el modo del documento antes de pintar, para que no se vea
 * el cromo dentro de las pestañas ni la página suelta detrás de la barra de pestañas.
 *  - Dentro de un iframe del panel → `data-embebido`; fuera del panel, saca a la ventana principal.
 *  - Ventana principal en /panel/[empresaId] de escritorio (≥1024px), salvo vistas de impresión
 *    → `data-workspace`.
 * La regla de escritorio se repite en `evaluarModo` (components/panel/workspace.ts).
 */
export const SCRIPT_MODO = `(function(){try{var d=document.documentElement,p=location.pathname;
if(window.top!==window.self){if(p.indexOf("/panel/")===0)d.setAttribute("data-embebido","");else window.top.location.href=location.href;}
else if(/^\\/panel\\/[^/]+/.test(p)&&!/\\/imprimir\\/?$/.test(p)&&window.matchMedia("(min-width: 1024px)").matches)d.setAttribute("data-workspace","");
}catch(e){}})();`;
