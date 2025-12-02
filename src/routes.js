import ArticleList from './components/ArticleList';
import ArticleDetail from './components/ArticleDetail';
import ArticleAdmin from './components/ArticleAdmin';

const routes = [
  {
    path: '/',
    component: ArticleList
  },
  {
    path: '/article/:id',
    component: ArticleDetail
  },
  {
    path: '/admin',
    component: ArticleAdmin
  }
];

export default routes;
