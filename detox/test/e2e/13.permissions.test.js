describe(':ios: Permissions', () => {

  it('Permissions is granted', async () => {
    const permissions = device.getPlatform() === 'web' ? { camera: 'YES' } : { calendar: 'YES' };
    await device.launchApp({permissions: permissions, newInstance: true});
    await element(by.text('Permissions')).tap();
    await waitFor(element(by.text('granted'))).toBeVisible().withTimeout(2000);
  });

  it('Permissions denied', async () => {
    const permissions = device.getPlatform() === 'web' ? { camera: 'NO' } : { calendar: 'NO' };
    await device.launchApp({permissions: permissions, newInstance: true});
    await element(by.text('Permissions')).tap();
    await waitFor(element(by.text('denied'))).toBeVisible().withTimeout(2000);
  });
});
