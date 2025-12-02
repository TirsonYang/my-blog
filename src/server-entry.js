import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { matchRoutes } from 'react-router-dom';
import { SSRProvider } from './SSRContext';
import App from './App';
import routes from './routes';

export async function render(req, template) {
  const matches = matchRoutes(routes, req.path);
  
  const promises = [];
  if (matches) {
    matches.forEach((m) => {
       const { route, params } = m;
       const component = route.component;
       if (component && component.loadData) {
         promises.push(component.loadData({ params }));
       }
    });
  }
  
  const dataResults = await Promise.all(promises);
  const context = dataResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  
  const appHtml = renderToString(
    <SSRProvider value={context}>
      <StaticRouter location={req.url}>
        <App />
      </StaticRouter>
    </SSRProvider>
  );
  
  return template.replace(
    '<div id="root"></div>', 
    `<div id="root">${appHtml}</div><script>window.__INITIAL_DATA__ = ${JSON.stringify(context).replace(/</g, '\\u003c')}</script>`
  );
}