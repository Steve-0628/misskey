import { App, defineAsyncComponent } from 'vue';

export default function(app: App) {
	app.component('WidgetInstanceInfo', defineAsyncComponent(() => import('./WidgetInstanceInfo.vue')));
	app.component('WidgetMemo', defineAsyncComponent(() => import('./WidgetMemo.vue')));
	app.component('WidgetNotifications', defineAsyncComponent(() => import('./WidgetNotifications.vue')));
	app.component('WidgetFederation', defineAsyncComponent(() => import('./WidgetFederation.vue')));
	app.component('WidgetPostForm', defineAsyncComponent(() => import('./WidgetPostForm.vue')));
	app.component('WidgetServerMetric', defineAsyncComponent(() => import('./server-metric/index.vue')));
	app.component('WidgetOnlineUsers', defineAsyncComponent(() => import('./WidgetOnlineUsers.vue')));
	app.component('WidgetJobQueue', defineAsyncComponent(() => import('./WidgetJobQueue.vue')));
	app.component('WidgetInstanceCloud', defineAsyncComponent(() => import('./WidgetInstanceCloud.vue')));
	app.component('WidgetAichan', defineAsyncComponent(() => import('./WidgetAichan.vue')));
}

export const widgets = [
	'instanceInfo',
	'memo',
	'notifications',
	'federation',
	'instanceCloud',
	'postForm',
	'serverMetric',
	'onlineUsers',
	'jobQueue',
	'aichan',
];
