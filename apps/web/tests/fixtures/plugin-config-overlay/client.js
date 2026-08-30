window.__ModuleLoader__.load({
  id: '@dsh-test/plugin-config-overlay',
  factory: (require) => {
    const React = require('react')
    const OverlaySettingsCard = () => React.createElement(
      'li',
      { 'data-overlay-settings-card': '' },
      React.createElement('strong', null, 'Overlay settings'),
    )
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
          name: 'settings.plugin.item',
          key: 'overlay-fixture',
        }, OverlaySettingsCard))
      },
    }
  },
})
